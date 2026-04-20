import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// GET /api/registrations/department?date=YYYY-MM-DD
// Trả về tất cả phiếu trong ngày, filter theo department của user (admin xem tất).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Thiếu tham số date' }, { status: 400 });
  }

  const filterDept = session.role !== 'admin' && session.department ? session.department : null;

  let regQuery = supabaseAdmin
    .from('overtime_registrations')
    .select(
      'id, department, day_type, time_from, time_to, duration_hours, status, created_at, registered_by',
    )
    .eq('overtime_date', date)
    .order('created_at', { ascending: false });
  if (filterDept) regQuery = regQuery.eq('department', filterDept);

  const { data: regs, error: regErr } = await regQuery;
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  const list = regs ?? [];
  if (list.length === 0) {
    return NextResponse.json({ registrations: [] });
  }

  const regIds = list.map((r) => r.id);
  const userIds = Array.from(new Set(list.map((r) => r.registered_by).filter(Boolean)));

  const [{ data: items }, { data: users }] = await Promise.all([
    supabaseAdmin
      .from('overtime_items')
      .select('registration_id')
      .in('registration_id', regIds),
    userIds.length > 0
      ? supabaseAdmin.from('users').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const countMap = new Map<string, number>();
  for (const it of items ?? []) {
    countMap.set(it.registration_id, (countMap.get(it.registration_id) ?? 0) + 1);
  }
  const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  return NextResponse.json({
    registrations: list.map((r) => ({
      ...r,
      items_count: countMap.get(r.id) ?? 0,
      registered_by_name: r.registered_by ? userMap.get(r.registered_by) ?? null : null,
    })),
  });
}
