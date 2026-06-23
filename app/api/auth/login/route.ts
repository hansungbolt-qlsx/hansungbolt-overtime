import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { signSession } from '@/lib/auth';
import { setSessionCookie } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { username, password, remember } = (await req.json()) as {
    username?: string;
    password?: string;
    remember?: boolean;
  };

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Thiếu tên đăng nhập hoặc mật khẩu' },
      { status: 400 },
    );
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, full_name, role, department, password_hash, active')
    .eq('username', username)
    .maybeSingle();

  if (!user) {
    return NextResponse.json(
      { error: 'Sai tên đăng nhập hoặc mật khẩu' },
      { status: 401 },
    );
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: 'Sai tên đăng nhập hoặc mật khẩu' },
      { status: 401 },
    );
  }

  if (user.active === false) {
    return NextResponse.json(
      { error: 'Tài khoản đã ngừng hoạt động. Vui lòng liên hệ admin.' },
      { status: 403 },
    );
  }

  const token = await signSession({
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    department: user.department,
  });
  await setSessionCookie(token, remember === true);

  return NextResponse.json({
    role: user.role,
    redirect: user.role === 'admin' ? '/dashboard' : '/register',
  });
}
