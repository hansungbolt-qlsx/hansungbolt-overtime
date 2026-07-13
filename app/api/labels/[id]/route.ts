import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const BUCKET = 'material-labels';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { id } = await params;

  const { data: rec, error: selErr } = await supabaseAdmin
    .from('material_label_photos')
    .select('id, storage_path, uploaded_by')
    .eq('id', id)
    .maybeSingle();
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!rec) return NextResponse.json({ error: 'Không tìm thấy ảnh' }, { status: 404 });

  if (session.role !== 'admin' && rec.uploaded_by !== session.userId) {
    return NextResponse.json({ error: 'Không có quyền xóa' }, { status: 403 });
  }

  await supabaseAdmin.storage
    .from(BUCKET)
    .remove([rec.storage_path, `${rec.storage_path}.thumb.jpg`]);
  const { error: delErr } = await supabaseAdmin
    .from('material_label_photos')
    .delete()
    .eq('id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
