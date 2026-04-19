import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Chưa đăng nhập hoặc không có quyền' }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Thiếu tham số date' }, { status: 400 });
  }

  const { data: regs, error } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, day_type, time_from, time_to, duration_hours, status, created_at')
    .eq('registered_by', session.userId)
    .eq('overtime_date', date)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const regIds = (regs ?? []).map((r) => r.id);
  const countMap = new Map<string, number>();
  if (regIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('overtime_items')
      .select('registration_id')
      .in('registration_id', regIds);
    for (const it of items ?? []) {
      countMap.set(it.registration_id, (countMap.get(it.registration_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    registrations: (regs ?? []).map((r) => ({
      ...r,
      items_count: countMap.get(r.id) ?? 0,
    })),
  });
}
