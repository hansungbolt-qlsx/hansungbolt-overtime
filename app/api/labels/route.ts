import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

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
    const path = `${date}/${Date.now()}_${rand}.${safeExt}`;
    const buf = await file.arrayBuffer();

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
        employee_name: typeof employeeName === 'string' ? employeeName : null,
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
    .select('id, storage_path, uploaded_at, uploaded_by, employee_name')
    .eq('label_date', date)
    .order('uploaded_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photos = await Promise.all(
    (data ?? []).map(async (p) => {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(p.storage_path, 3600);
      return {
        id: p.id,
        url: signed?.signedUrl ?? null,
        uploaded_at: p.uploaded_at,
        uploaded_by: p.uploaded_by,
        employee_name: p.employee_name ?? null,
      };
    }),
  );

  return NextResponse.json({ photos });
}
