import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import PrintClient from './PrintClient';

function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function PrintOvertimeSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const sp = await searchParams;
  const month = sp.month ?? currentMonthISO();

  if (!/^\d{4}-\d{2}$/.test(month)) redirect('/dashboard');

  const [y, m] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(y, m, 0).toISOString().slice(0, 10);

  const { data: regs } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, overtime_date, day_type')
    .gte('overtime_date', startDate)
    .lte('overtime_date', endDate)
    .order('overtime_date');

  if (!regs || regs.length === 0) {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif', color: '#555' }}>
        Không có dữ liệu tăng ca tháng {month}.{' '}
        <a href="/dashboard" style={{ color: '#063882' }}>Quay lại</a>
      </div>
    );
  }

  // Map: date -> day_type
  const dateTypeMap = new Map<string, 'weekday' | 'sunday'>();
  const regMap = new Map<string, { date: string; dayType: 'weekday' | 'sunday' }>();
  for (const r of regs) {
    dateTypeMap.set(r.overtime_date, r.day_type as 'weekday' | 'sunday');
    regMap.set(r.id, { date: r.overtime_date, dayType: r.day_type as 'weekday' | 'sunday' });
  }

  const regIds = regs.map((r) => r.id);
  const { data: items } = await supabaseAdmin
    .from('overtime_items')
    .select('employee_id, registration_id')
    .in('registration_id', regIds);

  // Build: empId -> { date -> hours }
  const empDateMap = new Map<string, Map<string, number>>();
  for (const it of items ?? []) {
    const reg = regMap.get(it.registration_id);
    if (!reg) continue;
    if (!empDateMap.has(it.employee_id)) empDateMap.set(it.employee_id, new Map());
    const dateMap = empDateMap.get(it.employee_id)!;
    if (!dateMap.has(reg.date)) {
      dateMap.set(reg.date, reg.dayType === 'sunday' ? 8 : 3);
    }
  }

  const empIds = Array.from(empDateMap.keys());
  const { data: emps } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, order_no')
    .in('id', empIds)
    .order('order_no', { ascending: true });

  const overtimeDates = Array.from(dateTypeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayType]) => ({ date, dayType }));

  const employees = (emps ?? []).map((e) => ({
    id: e.id,
    name: e.full_name,
    byDate: Object.fromEntries(empDateMap.get(e.id) ?? new Map<string, number>()),
  }));

  return <PrintClient month={month} overtimeDates={overtimeDates} employees={employees} />;
}
