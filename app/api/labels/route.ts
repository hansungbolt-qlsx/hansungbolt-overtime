import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

async function cropYellowLabel(inputBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(inputBuffer).metadata();
  const origW = meta.width ?? 0;
  const origH = meta.height ?? 0;
  if (!origW || !origH) return inputBuffer;

  // Resize xuống 800px để detection nhanh
  const detectW = 800;
  const detectH = Math.round(origH * (detectW / origW));

  const { data, info } = await sharp(inputBuffer)
    .resize(detectW, detectH)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels; // 3 hoặc 4
  let minX = detectW, maxX = 0, minY = detectH, maxY = 0;
  let yellowCount = 0;

  for (let y = 0; y < detectH; y++) {
    for (let x = 0; x < detectW; x++) {
      const i = (y * detectW + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // Màu vàng tem NVL: R cao, G trung cao, B thấp
      if (r > 155 && g > 110 && b < 110 && r - b > 70 && g - b > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        yellowCount++;
      }
    }
  }

  const yellowRatio = yellowCount / (detectW * detectH);
  // Nếu không tìm thấy vùng vàng đủ lớn → trả về ảnh gốc
  if (yellowRatio < 0.04 || maxX <= minX || maxY <= minY) return inputBuffer;

  // Scale tọa độ về kích thước gốc + padding 2%
  const scaleX = origW / detectW;
  const scaleY = origH / detectH;
  const padX = Math.floor((maxX - minX) * 0.02 * scaleX);
  const padY = Math.floor((maxY - minY) * 0.02 * scaleY);

  const left   = Math.max(0, Math.floor(minX * scaleX) - padX);
  const top    = Math.max(0, Math.floor(minY * scaleY) - padY);
  const right  = Math.min(origW, Math.ceil(maxX * scaleX) + padX);
  const bottom = Math.min(origH, Math.ceil(maxY * scaleY) + padY);

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
    const buf = await cropYellowLabel(rawBuf).catch(() => rawBuf);

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
