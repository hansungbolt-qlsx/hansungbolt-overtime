import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const WEEKDAY_HOURS = 3;
const SUNDAY_HOURS = 8;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const url = new URL(req.url);
  const month = url.searchParams.get('month'); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Thiếu hoặc sai định dạng month (YYYY-MM)' }, { status: 400 });
  }

  const [y, m] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(y, m, 0).toISOString().slice(0, 10); // last day of month

  // Non-admin chỉ xem dữ liệu bộ phận mình
  const filterDept = session.role !== 'admin' && session.department ? session.department : null;

  let regQuery = supabaseAdmin
    .from('overtime_registrations')
    .select('id, day_type')
    .gte('overtime_date', startDate)
    .lte('overtime_date', endDate);
  if (filterDept) regQuery = regQuery.eq('department', filterDept);
  const { data: regs, error: regErr } = await regQuery;

  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });
  if (!regs || regs.length === 0) return NextResponse.json({ month, summary: [] });

  const regMap = new Map(regs.map((r) => [r.id, r.day_type as 'weekday' | 'sunday']));
  const regIds = regs.map((r) => r.id);

  const { data: items, error: itemErr } = await supabaseAdmin
    .from('overtime_items')
    .select('employee_id, registration_id')
    .in('registration_id', regIds);

  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

  // Count distinct registrations per employee per day_type
  const empMap = new Map<string, { weekday: Set<string>; sunday: Set<string> }>();
  for (const it of items ?? []) {
    const dayType = regMap.get(it.registration_id) ?? 'weekday';
    if (!empMap.has(it.employee_id)) {
      empMap.set(it.employee_id, { weekday: new Set(), sunday: new Set() });
    }
    const cur = empMap.get(it.employee_id)!;
    cur[dayType].add(it.registration_id);
  }

  if (empMap.size === 0) return NextResponse.json({ month, summary: [] });

  const empIds = Array.from(empMap.keys());
  const { data: emps } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, order_no')
    .in('id', empIds)
    .order('order_no', { ascending: true });

  const nameMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
  const orderMap = new Map((emps ?? []).map((e) => [e.id, e.order_no ?? 9999]));

  const summary = Array.from(empMap.entries())
    .map(([id, counts]) => ({
      employee_id: id,
      employee_name: nameMap.get(id) ?? id,
      weekday_count: counts.weekday.size,
      sunday_count: counts.sunday.size,
      total_hours: counts.weekday.size * WEEKDAY_HOURS + counts.sunday.size * SUNDAY_HOURS,
    }))
    .sort((a, b) => (orderMap.get(a.employee_id) ?? 9999) - (orderMap.get(b.employee_id) ?? 9999));

  return NextResponse.json({ month, summary });
}
