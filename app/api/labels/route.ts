import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { toStorageKey, resolveDisplayName } from '@/lib/hd-employees';

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

  /**
   * Density-based scan: chỉ lấy các hàng có >=rowMin pixel khớp,
   * và các cột có >=colMin pixel khớp. Loại bỏ hàng/cột nền có ít pixel khớp.
   */
  function scanDense(
    pred: (r: number, g: number, b: number) => boolean,
    rowMin: number,  // ngưỡng tỉ lệ pixel khớp trên mỗi hàng
    colMin: number   // ngưỡng tỉ lệ pixel khớp trên mỗi cột
  ): BBox {
    const rowCounts = new Int32Array(detectH);
    const colCounts = new Int32Array(detectW);
    let count = 0;
    for (let y = 0; y < detectH; y++) {
      for (let x = 0; x < detectW; x++) {
        const i = (y * detectW + x) * ch;
        if (pred(data[i], data[i + 1], data[i + 2])) {
          rowCounts[y]++;
          colCounts[x]++;
          count++;
        }
      }
    }
    let minY = detectH, maxY = -1;
    for (let y = 0; y < detectH; y++) {
      if (rowCounts[y] / detectW >= rowMin) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    let minX = detectW, maxX = -1;
    for (let x = 0; x < detectW; x++) {
      if (colCounts[x] / detectH >= colMin) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    return { minX, maxX, minY, maxY, count };
  }

  function valid(b: BBox, minR: number, maxR: number): boolean {
    if (b.maxX < b.minX || b.maxY < b.minY) return false;
    return b.count / total >= minR && b.count / total <= maxR;
  }

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

  // ── Màu sắc từng loại tem (calibrated từ ảnh mẫu thực tế) ────────
  // 1. Vàng sáng — Daeho SWCH (phổ biến nhất)
  const isYellow = (r: number, g: number, b: number) =>
    r > 155 && g > 110 && b < 115 && r - b > 65 && g - b > 28;

  // 2. Cyan/xanh dương — Daeho SCM/GSCM
  //    G>168 phân biệt với túi nhựa kẻ sọc xanh (G thấp hơn ~155)
  const isCyan = (r: number, g: number, b: number) =>
    b > 185 && g > 168 && r < 158 && b - r > 60 && g - r > 40;

  // 3. Nền xanh lá nhà máy
  const isGreenBg = (r: number, g: number, b: number) =>
    g > 90 && g > r * 1.10 && g > b * 1.02 && g < 210;

  // 4. Trắng/kem — Daeho trắng, Vinh Thành, NGK, KOS
  const isWhite = (r: number, g: number, b: number) =>
    r > 185 && g > 185 && b > 185;

  const greenBg  = borderRatio(isGreenBg);
  const whiteBdr = borderRatio(isWhite);

  let best: BBox | null = null;

  // Ưu tiên 1: Tem vàng — row 20%, col 10%
  const yellow = scanDense(isYellow, 0.20, 0.10);
  if (valid(yellow, 0.04, 0.85)) best = yellow;

  // Ưu tiên 2: Tem cyan/xanh — row 18%, col 10%
  if (!best) {
    const cyan = scanDense(isCyan, 0.18, 0.10);
    if (valid(cyan, 0.04, 0.85)) best = cyan;
  }

  // Ưu tiên 3: Tem trắng/màu khác trên nền xanh lá nhà máy — row 25%, col 18%
  if (!best && greenBg > 0.18) {
    const notGreen = scanDense(
      (r, g, b) => !isGreenBg(r, g, b) && Math.max(r, g, b) > 100,
      0.25, 0.18
    );
    if (valid(notGreen, 0.05, 0.72)) best = notGreen;
  }

  // Ưu tiên 4: Vùng trắng đặc khi viền ảnh không trắng — row 45%, col 30%
  if (!best && whiteBdr < 0.22) {
    const white = scanDense(isWhite, 0.45, 0.30);
    if (valid(white, 0.05, 0.72)) best = white;
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
    const nameSuffix = typeof employeeName === 'string' && employeeName
      ? `__${toStorageKey(employeeName)}`
      : '';
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
      const rawKey = parts.length >= 2 ? parts[1] : null;
      const employee_name = rawKey ? resolveDisplayName(rawKey) : null;
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
