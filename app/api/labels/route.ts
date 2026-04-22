import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { toStorageKey, resolveDisplayName } from '@/lib/hd-employees';

export const runtime = 'nodejs';

// Không xử lý/crop ảnh server-side nữa — nhân viên chụp sao, lưu nguyên vậy.
// Logic cropLabel trước đây bị loại bỏ do nhận dạng sai làm biến dạng 1 số tem.

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

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const rand = Math.random().toString(36).slice(2, 8);
    const nameSuffix = typeof employeeName === 'string' && employeeName
      ? `__${toStorageKey(employeeName)}`
      : '';
    const path = `${date}/${Date.now()}_${rand}${nameSuffix}.${safeExt}`;
    const buf = Buffer.from(await file.arrayBuffer());

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

  const paths = data.map((p) => p.storage_path);
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
