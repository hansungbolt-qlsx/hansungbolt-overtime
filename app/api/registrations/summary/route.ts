import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { buildEmpDateHours } from '@/lib/overtime-hours';

export const runtime = 'nodejs';

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
  // admin + qlsx (user 24/7) xem tất cả bộ phận; leader/worker lọc theo dept mình
  const filterDept = session.role !== 'admin' && session.role !== 'qlsx'
    && session.department ? session.department : null;

  let regQuery = supabaseAdmin
    .from('overtime_registrations')
    .select('id, overtime_date, day_type, duration_hours, department, shift')
    .gte('overtime_date', startDate)
    .lte('overtime_date', endDate);
  if (filterDept) regQuery = regQuery.eq('department', filterDept);
  const { data: regs, error: regErr } = await regQuery;

  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });
  if (!regs || regs.length === 0) return NextResponse.json({ month, summary: [], dates: [] });

  // Chi tiết theo ngày (anh Hữu 08/10/2026): cột ngày = mọi ngày có phiếu (như trang in), kèm bộ phận có phiếu ngày đó
  // để tab bộ phận chỉ hiện ngày của bộ phận đó (= trang in ?dept=)
  const dateInfo = new Map<string, { day_type: 'weekday' | 'sunday'; depts: Set<string> }>();
  for (const r of regs) {
    const d = dateInfo.get(r.overtime_date) ?? { day_type: r.day_type as 'weekday' | 'sunday', depts: new Set<string>() };
    if (r.department) d.depts.add(r.department);
    dateInfo.set(r.overtime_date, d);
  }
  const dates = [...dateInfo.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, day_type: d.day_type, depts: [...d.depts] }));

  const regIds = regs.map((r) => r.id);

  const { data: items, error: itemErr } = await supabaseAdmin
    .from('overtime_items')
    .select('employee_id, registration_id, duration_hours')
    .in('registration_id', regIds);

  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

  // Giờ người × ngày: luật DÙNG CHUNG lib/overtime-hours.ts (item admin sửa → phiếu → 3h/8h;
  // trong một ca lấy MAX, ca AM + PM cộng lại — anh Hữu 21/10/2026). Đừng chép luật vào đây.
  const { empDateMap, dateTypeMap } = buildEmpDateHours(regs, items ?? []);

  type Bucket = { weekdayDays: Set<string>; sundayDays: Set<string>; totalHours: number };
  const empMap = new Map<string, Bucket>();
  for (const [empId, dateMap] of empDateMap) {
    const b: Bucket = { weekdayDays: new Set(), sundayDays: new Set(), totalHours: 0 };
    for (const [date, hours] of dateMap) {
      if (dateTypeMap.get(date) === 'sunday') b.sundayDays.add(date);
      else b.weekdayDays.add(date);
      b.totalHours += hours;
    }
    empMap.set(empId, b);
  }

  if (empMap.size === 0) return NextResponse.json({ month, summary: [], dates });

  const empIds = Array.from(empMap.keys());
  const { data: emps } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, department, order_no')
    .in('id', empIds)
    .order('order_no', { ascending: true });

  const nameMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
  const deptMap = new Map((emps ?? []).map((e) => [e.id, e.department]));
  const orderMap = new Map((emps ?? []).map((e) => [e.id, e.order_no ?? 9999]));

  const summary = Array.from(empMap.entries())
    .map(([id, b]) => ({
      employee_id: id,
      employee_name: nameMap.get(id) ?? id,
      employee_department: deptMap.get(id) ?? null,
      weekday_count: b.weekdayDays.size,
      sunday_count: b.sundayDays.size,
      total_hours: Number(b.totalHours.toFixed(2)),
      by_date: Object.fromEntries(empDateMap.get(id) ?? new Map<string, number>()),
    }))
    .sort((a, b) => (orderMap.get(a.employee_id) ?? 9999) - (orderMap.get(b.employee_id) ?? 9999));

  return NextResponse.json({ month, summary, dates });
}
