import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildEmpDateHours } from '@/lib/overtime-hours';
import PrintClient from './PrintClient';

function currentMonthISO() {
  // Server UTC lệch −7h so VN — cộng 7h + getUTC* để đúng tháng theo giờ VN
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
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

  const regIds = regs.map((r) => r.id);
  const { data: items } = await supabaseAdmin
    .from('overtime_items')
    .select('employee_id, registration_id, duration_hours')
    .in('registration_id', regIds);

  // Luật quy giờ (item admin sửa → registration → 8h CN/3h thường, trùng ngày
  // lấy MAX) nằm MỘT CHỖ ở lib/overtime-hours.ts — dùng chung với API đồng bộ
  // sang app chính (menu Overtime). Sửa luật thì sửa ở lib, đừng sửa tại đây.
  const { empDateMap, dateTypeMap } = buildEmpDateHours(regs, items ?? []);

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
