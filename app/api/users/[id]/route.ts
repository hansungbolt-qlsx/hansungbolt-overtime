import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// DELETE /api/users/[id] — xóa user (admin only, không cho xóa chính mình)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: 'Không thể tự xóa tài khoản đang đăng nhập' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
