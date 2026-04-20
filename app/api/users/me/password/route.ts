import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// POST /api/users/me/password — user tự đổi mật khẩu
// Body: { currentPassword: string, newPassword: string }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const currentPassword = (body.currentPassword ?? '').trim();
  const newPassword = (body.newPassword ?? '').trim();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Vui lòng nhập đầy đủ mật khẩu' }, { status: 400 });
  }
  if (newPassword.length < 4) {
    return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 4 ký tự' }, { status: 400 });
  }

  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, password_hash')
    .eq('id', session.userId)
    .maybeSingle();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'Không tìm thấy tài khoản' }, { status: 404 });

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const { error: updErr } = await supabaseAdmin
    .from('users')
    .update({ password_hash: newHash, password_plain: newPassword })
    .eq('id', session.userId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
