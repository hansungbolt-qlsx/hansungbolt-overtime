import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// Tự động nhận dạng và crop vùng tem NVL — hỗ trợ nhiều màu tem khác nhau
async function cropLabel(inputBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(inputBuffer).metadata();
  const origW = meta.width ?? 0;
  const origH = meta.height ?? 0;
  if (!origW || !origH) return inputBuffer;

  const detectW = 800;
  const detectH = Math.round(origH * (detectW / origW));
  const total = detectW * detectH;

  const { data, info } = await sharp(inputBuffer)
    .resize(detectW, detectH)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;

  type BBox = { minX: number; maxX: number; minY: number; maxY: number; count: number };

  function scan(pred: (r: number, g: number, b: number) => boolean): BBox {
    let minX = detectW, maxX = -1, minY = detectH, maxY = -1, count = 0;
    for (let y = 0; y < detectH; y++) {
      for (let x = 0; x < detectW; x++) {
        const i = (y * detectW + x) * ch;
        if (pred(data[i], data[i + 1], data[i + 2])) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          count++;
        }
      }
    }
    return { minX, maxX, minY, maxY, count };
  }

  // Kiểm tra vùng hợp lệ: pixel đủ nhiều, bbox không quá nhỏ/lớn, mật độ > 30%
  function valid(b: BBox, minR: number, maxR: number): boolean {
    if (b.maxX < b.minX || b.maxY < b.minY) return false;
    const ratio = b.count / total;
    if (ratio < minR || ratio > maxR) return false;
    const boxArea = (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1);
    return b.count / boxArea >= 0.28;
  }

  // Tỉ lệ pixel khớp ở viền ảnh (outer 8%) — dùng phán đoán nền
  function borderRatio(pred: (r: number, g: number, b: number) => boolean): number {
    const mg = Math.floor(Math.min(detectW, detectH) * 0.08);
    let match = 0, tot = 0;
    for (let y = 0; y < detectH; y++) {
      for (let x = 0; x < detectW; x++) {
        if (x < mg || x > detectW - mg || y < mg || y > detectH - mg) {
          tot++;
          const i = (y * detectW + x) * ch;
          if (pred(data[i], data[i + 1], data[i + 2])) match++;
        }
      }
    }
    return match / tot;
  }

  // ── Màu sắc từng loại tem ────────────────────────────────────────
  // 1. Vàng sáng — Daeho vàng (SWCH series)
  const isYellow = (r: number, g: number, b: number) =>
    r > 155 && g > 110 && b < 115 && r - b > 65 && g - b > 28;

  // 2. Xanh dương/cyan — Daeho xanh (SCM/GSCM series)
  const isCyan = (r: number, g: number, b: number) =>
    b > 170 && g > 135 && r < 180 && b - r > 45;

  // 3. Nền xanh lá nhà máy (sắt sơn xanh)
  const isGreenBg = (r: number, g: number, b: number) =>
    g > 90 && g > r * 1.10 && g > b * 1.02 && g < 210;

  // 4. Trắng/kem — Daeho trắng, Vinh Thành, NGK, KOS
  const isWhite = (r: number, g: number, b: number) =>
    r > 185 && g > 185 && b > 185;

  const greenBg  = borderRatio(isGreenBg);
  const whiteBdr = borderRatio(isWhite);

  let best: BBox | null = null;

  // Ưu tiên 1: Tem vàng
  const yellow = scan(isYellow);
  if (valid(yellow, 0.04, 0.85)) { best = yellow; }

  // Ưu tiên 2: Tem xanh dương/cyan
  if (!best) {
    const cyan = scan(isCyan);
    if (valid(cyan, 0.04, 0.85)) { best = cyan; }
  }

  // Ưu tiên 3: Nền xanh lá → tìm vùng sáng không xanh lá (tem trắng, KOS, v.v.)
  if (!best && greenBg > 0.18) {
    const notGreen = scan((r, g, b) => !isGreenBg(r, g, b) && Math.max(r, g, b) > 100);
    if (valid(notGreen, 0.05, 0.72)) { best = notGreen; }
  }

  // Ưu tiên 4: Vùng trắng (khi viền ảnh không trắng)
  if (!best && whiteBdr < 0.22) {
    const white = scan(isWhite);
    if (valid(white, 0.05, 0.72)) { best = white; }
  }

  if (!best) return inputBuffer;

  const scaleX = origW / detectW;
  const scaleY = origH / detectH;
  const padX   = Math.floor((best.maxX - best.minX) * 0.025 * scaleX);
  const padY   = Math.floor((best.maxY - best.minY) * 0.025 * scaleY);

  const left   = Math.max(0, Math.floor(best.minX * scaleX) - padX);
  const top    = Math.max(0, Math.floor(best.minY * scaleY) - padY);
  const right  = Math.min(origW, Math.ceil(best.maxX * scaleX) + padX);
  const bottom = Math.min(origH, Math.ceil(best.maxY * scaleY) + padY);

  return sharp(inputBuffer)
    .extract({ left, top, width: right - left, height: bottom - top })
    .jpeg({ quality: 88 })
    .toBuffer();
}

const BUCKET = 'material-labels';
const MAX_FILES = 30;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'leader' || session.department !== 'HD') {
    return NextResponse.json(
      { error: 'Chỉ tổ trưởng HD được upload tem NVL' },
      { status: 403 },
    );
  }

  const form = await req.formData();
  const date = form.get('date');
  const employeeName = form.get('employee_name');
  const files = form.getAll('files');

  if (typeof date !== 'string' || !date) {
    return NextResponse.json({ error: 'Thiếu ngày' }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: 'Chưa chọn ảnh nào' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Upload tối đa ${MAX_FILES} ảnh/lần` },
      { status: 400 },
    );
  }

  const uploaded: string[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    if (!(file instanceof File)) {
      warnings.push('Bỏ qua item không phải file');
      continue;
    }
    if (file.size > MAX_SIZE) {
      warnings.push(`${file.name}: quá 10MB, bỏ qua`);
      continue;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      warnings.push(`${file.name}: không phải jpg/png/webp, bỏ qua`);
      continue;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const rand = Math.random().toString(36).slice(2, 8);
    const nameSuffix = typeof employeeName === 'string' && employeeName ? `__${employeeName}` : '';
    const path = `${date}/${Date.now()}_${rand}${nameSuffix}.${safeExt}`;
    const rawBuf = Buffer.from(await file.arrayBuffer());
    const buf = await cropLabel(rawBuf).catch(() => rawBuf);

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType: file.type,
        upsert: false,
      });
    if (upErr) {
      warnings.push(`${file.name}: upload lỗi — ${upErr.message}`);
      continue;
    }

    const { data: rec, error: insErr } = await supabaseAdmin
      .from('material_label_photos')
      .insert({
        label_date: date,
        storage_path: path,
        uploaded_by: session.userId,
      })
      .select('id')
      .single();
    if (insErr || !rec) {
      await supabaseAdmin.storage.from(BUCKET).remove([path]);
      warnings.push(`${file.name}: lưu DB lỗi — ${insErr?.message ?? 'unknown'}`);
      continue;
    }
    uploaded.push(rec.id);
  }

  return NextResponse.json({
    uploaded: uploaded.length,
    total: files.length,
    warnings,
  });
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Thiếu date' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('material_label_photos')
    .select('id, storage_path, uploaded_at, uploaded_by')
    .eq('label_date', date)
    .order('uploaded_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photos = await Promise.all(
    (data ?? []).map(async (p) => {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(p.storage_path, 3600);
      const filename = p.storage_path.split('/').pop() ?? '';
      const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
      const parts = nameWithoutExt.split('__');
      const employee_name = parts.length >= 2 ? parts[1] : null;
      return {
        id: p.id,
        url: signed?.signedUrl ?? null,
        uploaded_at: p.uploaded_at,
        uploaded_by: p.uploaded_by,
        employee_name,
      };
    }),
  );

  return NextResponse.json({ photos });
}
