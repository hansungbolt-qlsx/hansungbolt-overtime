import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// POST /api/users/[id]/reset-password — reset về username
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { id } = await params;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('username')
    .eq('id', id)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
  }

  const newHash = await bcrypt.hash(user.username, 10);
  const { error } = await supabaseAdmin
    .from('users')
    .update({ password_hash: newHash })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, password: user.username });
}
