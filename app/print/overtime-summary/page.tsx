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
  searchParams: Promise<{ month?: string; dept?: string; preview?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const sp = await searchParams;
  const month = sp.month ?? currentMonthISO();
  const previewMode = sp.preview === '1';

  if (!/^\d{4}-\d{2}$/.test(month)) redirect('/dashboard');

  const [y, m] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(y, m, 0).toISOString().slice(0, 10);

  // Filter dept: admin có thể truyền ?dept=HD/RL/QLSX để xem riêng từng bộ phận;
  // non-admin luôn force theo dept của mình.
  const requestedDept =
    sp.dept === 'HD' || sp.dept === 'RL' || sp.dept === 'QLSX' ? sp.dept : null;
  const filterDept =
    session.role !== 'admin' && session.department
      ? session.department
      : requestedDept;
  let regQuery = supabaseAdmin
    .from('overtime_registrations')
    .select('id, overtime_date, day_type, duration_hours')
    .gte('overtime_date', startDate)
    .lte('overtime_date', endDate)
    .order('overtime_date');
  if (filterDept) regQuery = regQuery.eq('department', filterDept);
  const { data: regs } = await regQuery;

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
  const regMap = new Map<
    string,
    { date: string; dayType: 'weekday' | 'sunday'; durationHours: number }
  >();
  for (const r of regs) {
    dateTypeMap.set(r.overtime_date, r.day_type as 'weekday' | 'sunday');
    regMap.set(r.id, {
      date: r.overtime_date,
      dayType: r.day_type as 'weekday' | 'sunday',
      durationHours: Number(r.duration_hours ?? 0),
    });
  }

  const regIds = regs.map((r) => r.id);
  const { data: items } = await supabaseAdmin
    .from('overtime_items')
    .select('employee_id, registration_id, duration_hours')
    .in('registration_id', regIds);

  // Build: empId -> { date -> hours thực tế }
  // Ưu tiên duration_hours của item (từ migration 06 — admin đã sửa per-row),
  // fallback duration_hours của registration (leader submit ban đầu),
  // fallback hardcoded theo day_type.
  // Nếu 1 NV có nhiều item cùng ngày với duration khác nhau → lấy MAX.
  const empDateMap = new Map<string, Map<string, number>>();
  for (const it of items ?? []) {
    const reg = regMap.get(it.registration_id);
    if (!reg) continue;
    if (!empDateMap.has(it.employee_id)) empDateMap.set(it.employee_id, new Map());
    const dateMap = empDateMap.get(it.employee_id)!;
    const hours = Number(
      it.duration_hours ??
        reg.durationHours ??
        (reg.dayType === 'sunday' ? 8 : 3),
    );
    const existing = dateMap.get(reg.date) ?? 0;
    if (hours > existing) dateMap.set(reg.date, hours);
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

  return (
    <PrintClient
      month={month}
      overtimeDates={overtimeDates}
      employees={employees}
      dept={filterDept}
      preview={previewMode}
    />
  );
}
