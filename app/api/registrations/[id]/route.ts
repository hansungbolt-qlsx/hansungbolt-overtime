import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Chưa đăng nhập hoặc không có quyền' }, { status: 401 });
  }

  const { id } = await params;

  const { data: reg, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, registered_by')
    .eq('id', id)
    .maybeSingle();
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });
  if (!reg) return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 });
  if (reg.registered_by !== session.userId) {
    return NextResponse.json({ error: 'Không có quyền xóa phiếu này' }, { status: 403 });
  }

  const { error: delErr } = await supabaseAdmin
    .from('overtime_registrations')
    .delete()
    .eq('id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
