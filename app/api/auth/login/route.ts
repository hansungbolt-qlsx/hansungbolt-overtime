import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { signSession } from '@/lib/auth';
import { setSessionCookie } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { username, password } = (await req.json()) as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Thiếu tên đăng nhập hoặc mật khẩu' },
      { status: 400 },
    );
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, full_name, role, department, password_hash')
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

  const token = await signSession({
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    department: user.department,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    role: user.role,
    redirect: user.role === 'admin' ? '/dashboard' : '/register',
  });
}
