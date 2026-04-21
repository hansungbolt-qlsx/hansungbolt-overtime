import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

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
  const filterDept = session.role !== 'admin' && session.department ? session.department : null;

  let regQuery = supabaseAdmin
    .from('overtime_registrations')
    .select('id, overtime_date, day_type, duration_hours')
    .gte('overtime_date', startDate)
    .lte('overtime_date', endDate);
  if (filterDept) regQuery = regQuery.eq('department', filterDept);
  const { data: regs, error: regErr } = await regQuery;

  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });
  if (!regs || regs.length === 0) return NextResponse.json({ month, summary: [] });

  const regMap = new Map(
    regs.map((r) => [
      r.id,
      {
        date: r.overtime_date as string,
        dayType: r.day_type as 'weekday' | 'sunday',
        durationHours: Number(r.duration_hours ?? 0),
      },
    ]),
  );
  const regIds = regs.map((r) => r.id);

  const { data: items, error: itemErr } = await supabaseAdmin
    .from('overtime_items')
    .select('employee_id, registration_id, duration_hours')
    .in('registration_id', regIds);

  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

  // Per employee per date: hours thực tế
  //   Ưu tiên duration_hours item (admin sửa per-row), fallback reg.duration_hours,
  //   fallback hardcoded 3/8 theo day_type. Nhiều item cùng ngày → lấy MAX.
  type Bucket = { weekdayDays: Set<string>; sundayDays: Set<string>; totalHours: number };
  const empMap = new Map<string, Bucket>();
  // Trước tiên collect hours per (emp, date) để tránh double-count khi cùng NV có nhiều items/ngày
  const empDateHours = new Map<string, Map<string, { hours: number; dayType: 'weekday' | 'sunday' }>>();
  for (const it of items ?? []) {
    const reg = regMap.get(it.registration_id);
    if (!reg) continue;
    if (!empDateHours.has(it.employee_id)) empDateHours.set(it.employee_id, new Map());
    const dateMap = empDateHours.get(it.employee_id)!;
    const hours = Number(
      it.duration_hours ?? reg.durationHours ?? (reg.dayType === 'sunday' ? 8 : 3),
    );
    const existing = dateMap.get(reg.date);
    if (!existing || hours > existing.hours) {
      dateMap.set(reg.date, { hours, dayType: reg.dayType });
    }
  }

  for (const [empId, dateMap] of empDateHours) {
    const b: Bucket = { weekdayDays: new Set(), sundayDays: new Set(), totalHours: 0 };
    for (const [date, { hours, dayType }] of dateMap) {
      if (dayType === 'sunday') b.sundayDays.add(date);
      else b.weekdayDays.add(date);
      b.totalHours += hours;
    }
    empMap.set(empId, b);
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
    .map(([id, b]) => ({
      employee_id: id,
      employee_name: nameMap.get(id) ?? id,
      weekday_count: b.weekdayDays.size,
      sunday_count: b.sundayDays.size,
      total_hours: Number(b.totalHours.toFixed(2)),
    }))
    .sort((a, b) => (orderMap.get(a.employee_id) ?? 9999) - (orderMap.get(b.employee_id) ?? 9999));

  return NextResponse.json({ month, summary });
}
