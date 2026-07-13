import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { toStorageKey, resolveDisplayName } from '@/lib/hd-employees';

export const runtime = 'nodejs';

// Chuẩn hóa ảnh để fit ô in A4 (105×74mm = landscape) + NÉN tiết kiệm egress
// (13/7 — gói Free 5GB/tháng chạm 90%, thủ phạm = ảnh điện thoại 3-6MB/tấm):
//   1. Áp dụng EXIF orientation rồi strip tag (phone chụp xoay nhưng flag EXIF).
//   2. Nếu sau EXIF mà ảnh dọc (H > W) → xoay 90° CW để thành ngang.
//   3. Resize cạnh dài ≤1600px + JPEG q80 → ~200-400KB/ảnh; in lưới 8 ô/A4
//      (~105mm/ô) thì 1600px vẫn thừa nét.
// KHÔNG crop/nhận dạng vùng tem — nhân viên chụp sao lưu vậy (chỉ xoay).
async function orientForLandscapeSlot(input: Buffer): Promise<Buffer> {
  // Step 1: EXIF auto-orient + strip. .rotate() không có args = tự xoay theo EXIF.
  const oriented = await sharp(input).rotate().toBuffer();
  const meta = await sharp(oriented).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  let pipeline = sharp(oriented);
  // Step 2: Dọc → xoay 90° CW thành ngang (fit ô in landscape).
  if (h > w) pipeline = pipeline.rotate(90);

  // Step 3: nén — sau xoay ảnh luôn ngang nên width = cạnh dài.
  return pipeline
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

const BUCKET = 'material-labels';
const MAX_FILES = 30;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
  const session = await getSession();
  // HD leader + worker đều được upload; admin cũng OK
  if (
    !session ||
    !(
      session.role === 'admin' ||
      ((session.role === 'leader' || session.role === 'worker') && session.department === 'HD')
    )
  ) {
    return NextResponse.json(
      { error: 'Chỉ nhân viên HD được upload tem NVL' },
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

    const rand = Math.random().toString(36).slice(2, 8);
    const nameSuffix = typeof employeeName === 'string' && employeeName
      ? `__${toStorageKey(employeeName)}`
      : '';
    // Sau nén luôn là JPEG
    const path = `${date}/${Date.now()}_${rand}${nameSuffix}.jpg`;
    const rawBuf = Buffer.from(await file.arrayBuffer());
    // Xoay ngang + nén — fallback raw nếu sharp fail với ảnh đặc biệt.
    let buf: Buffer = rawBuf;
    let ctype = file.type;
    try {
      buf = await orientForLandscapeSlot(rawBuf);
      ctype = 'image/jpeg';
    } catch {
      /* giữ nguyên gốc */
    }

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType: ctype,
        upsert: false,
        // Ảnh bất biến (tên file random) → cache dài để trình duyệt không tải lại
        cacheControl: '2592000',
      });
    if (upErr) {
      warnings.push(`${file.name}: upload lỗi — ${upErr.message}`);
      continue;
    }
    // THUMBNAIL 320px (~15-25KB) cho lưới xem — 13 người mở app xem lưới mỗi
    // ngày chỉ tốn vài MB egress thay vì tải ảnh đầy đủ; ảnh full chỉ tải khi
    // bấm phóng to / in. Best-effort: thiếu thumb thì client fallback ảnh full.
    try {
      const thumb = await sharp(buf)
        .resize({ width: 320, withoutEnlargement: true })
        .jpeg({ quality: 70, mozjpeg: true })
        .toBuffer();
      await supabaseAdmin.storage.from(BUCKET).upload(`${path}.thumb.jpg`, thumb, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '2592000',
      });
    } catch {
      /* thumb best-effort */
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

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  // Chỉ admin và HD leader mới được xóa toàn bộ (worker không có quyền xóa hàng loạt)
  const isAdmin = session.role === 'admin';
  const isHdLeader = session.role === 'leader' && session.department === 'HD';
  if (!isAdmin && !isHdLeader) {
    return NextResponse.json({ error: 'Không có quyền xóa toàn bộ' }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'Thiếu date' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('material_label_photos')
    .select('id, storage_path')
    .eq('label_date', date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ deleted: 0 });

  const paths = data.flatMap((p) => [p.storage_path, `${p.storage_path}.thumb.jpg`]);
  await supabaseAdmin.storage.from(BUCKET).remove(paths);

  const { error: delErr } = await supabaseAdmin
    .from('material_label_photos')
    .delete()
    .eq('label_date', date);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ deleted: data.length });
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

  // Public URL CỐ ĐỊNH (bucket đã chuyển public 13/7 — tên file random không
  // đoán được): trình duyệt cache được → hết cảnh mỗi lần mở trang tải lại
  // toàn bộ ảnh (signed URL cũ đổi token mỗi lần gọi = cache vô dụng, thủ
  // phạm chính làm egress Free 5GB chạm 90%).
  const photos = (data ?? []).map((p) => {
    const { data: pub } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(p.storage_path);
    const { data: pubThumb } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(`${p.storage_path}.thumb.jpg`);
    const filename = p.storage_path.split('/').pop() ?? '';
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    const parts = nameWithoutExt.split('__');
    const rawKey = parts.length >= 2 ? parts[1] : null;
    const employee_name = rawKey ? resolveDisplayName(rawKey) : null;
    return {
      id: p.id,
      url: pub?.publicUrl ?? null,
      thumb_url: pubThumb?.publicUrl ?? null,
      uploaded_at: p.uploaded_at,
      uploaded_by: p.uploaded_by,
      employee_name,
    };
  });

  return NextResponse.json({ photos });
}
