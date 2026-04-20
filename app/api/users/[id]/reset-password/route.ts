import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const DEFAULT_PASSWORD = 'hd123';

// POST /api/users/[id]/reset-password — reset về 'hd123'
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
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
  }

  const newHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const { error } = await supabaseAdmin
    .from('users')
    .update({ password_hash: newHash, password_plain: DEFAULT_PASSWORD })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, password: DEFAULT_PASSWORD });
}
