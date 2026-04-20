import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// GET /api/users — list tất cả user (admin only)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, username, full_name, role, department, created_at')
    .order('role', { ascending: false }) // admin → leader → worker (desc theo alphabet)
    .order('department', { ascending: true })
    .order('full_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data ?? [] });
}
