import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

type EmployeeRow = {
  employee_id: string;
  employee_name: string;
  order_no: number;
  machines: Array<{ code: string; isOther: boolean; otherText?: string }>;
};

type MachineDetail = {
  equipment_code: string;
  item_code: string | null;
  employee_name: string;
  employee_order: number;
  is_other: boolean;
};

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Thiếu hoặc sai định dạng date (YYYY-MM-DD)' },
      { status: 400 },
    );
  }

  // Non-admin chỉ thấy phiếu bộ phận mình; admin thấy cả 2.
  const restrictDept =
    session.role !== 'admin' && session.department
      ? (session.department as 'HD' | 'RL')
      : null;

  let regQuery = supabaseAdmin
    .from('overtime_registrations')
    .select('id, department')
    .eq('overtime_date', date);
  if (restrictDept) regQuery = regQuery.eq('department', restrictDept);
  const { data: regs, error: regErr } = await regQuery;
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  if (!regs || regs.length === 0) {
    return NextResponse.json({
      date,
      restrictDept,
      departments: { HD: [], RL: [] },
      details: { HD: [], RL: [] },
    });
  }

  const regDeptMap = new Map(regs.map((r) => [r.id, r.department as string]));
  const regIds = regs.map((r) => r.id);

  const { data: items, error: itErr } = await supabaseAdmin
    .from('overtime_items')
    .select('employee_id, equipment_id, item_code, registration_id')
    .in('registration_id', regIds);
  if (itErr) return NextResponse.json({ error: itErr.message }, { status: 500 });

  const empIds = Array.from(new Set((items ?? []).map((i) => i.employee_id)));
  const eqIds = Array.from(new Set((items ?? []).map((i) => i.equipment_id)));

  const [{ data: emps }, { data: eqs }] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('id, full_name, order_no, department')
      .in('id', empIds),
    supabaseAdmin
      .from('equipments')
      .select('id, code, machine_type')
      .in('id', eqIds),
  ]);

  const empMap = new Map((emps ?? []).map((e) => [e.id, e]));
  const eqMap = new Map((eqs ?? []).map((e) => [e.id, e]));

  // Group by (department, employee_id) → machines[]
  type Key = string; // `${dept}:${empId}`
  const groupMap = new Map<Key, EmployeeRow & { dept: string }>();

  for (const it of items ?? []) {
    const dept = regDeptMap.get(it.registration_id);
    const emp = empMap.get(it.employee_id);
    const eq = eqMap.get(it.equipment_id);
    if (!dept || !emp || !eq) continue;

    const key: Key = `${dept}:${emp.id}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        dept,
        employee_id: emp.id,
        employee_name: emp.full_name,
        order_no: emp.order_no ?? 9999,
        machines: [],
      });
    }
    const g = groupMap.get(key)!;
    const isOther = eq.machine_type === 'OTHER';
    g.machines.push({
      code: eq.code,
      isOther,
      otherText: isOther ? it.item_code : undefined,
    });
  }

  const hd: EmployeeRow[] = [];
  const rl: EmployeeRow[] = [];
  for (const row of groupMap.values()) {
    const { dept, ...rest } = row;
    if (dept === 'HD') hd.push(rest);
    else if (dept === 'RL') rl.push(rest);
  }
  hd.sort((a, b) => a.order_no - b.order_no);
  rl.sort((a, b) => a.order_no - b.order_no);

  // Chi tiết từng máy — để NV chụp gửi nhóm cho biết ai chạy máy nào + mã hàng nào.
  // 1 dòng = 1 item (1 máy × 1 mã hàng × 1 NV).
  // Sort: theo NV (order_no) trước → trong nhóm NV sort theo mã máy → mã hàng.
  const detailsHD: MachineDetail[] = [];
  const detailsRL: MachineDetail[] = [];
  for (const it of items ?? []) {
    const dept = regDeptMap.get(it.registration_id);
    const emp = empMap.get(it.employee_id);
    const eq = eqMap.get(it.equipment_id);
    if (!dept || !emp || !eq) continue;
    const isOther = eq.machine_type === 'OTHER';
    const row: MachineDetail = {
      equipment_code: eq.code,
      item_code: it.item_code ?? null,
      employee_name: emp.full_name,
      employee_order: emp.order_no ?? 9999,
      is_other: isOther,
    };
    if (dept === 'HD') detailsHD.push(row);
    else if (dept === 'RL') detailsRL.push(row);
  }
  detailsHD.sort(compareDetail);
  detailsRL.sort(compareDetail);

  return NextResponse.json({
    date,
    restrictDept,
    departments: { HD: hd, RL: rl },
    details: { HD: detailsHD, RL: detailsRL },
  });
}

function compareDetail(a: MachineDetail, b: MachineDetail): number {
  // 1. Theo NV (order_no asc) — NV order thấp đứng trước
  if (a.employee_order !== b.employee_order) return a.employee_order - b.employee_order;
  if (a.employee_name !== b.employee_name) return a.employee_name.localeCompare(b.employee_name, 'vi');
  // 2. CVK đẩy xuống cuối trong nhóm NV
  if (a.is_other !== b.is_other) return a.is_other ? 1 : -1;
  // 3. Theo mã máy tự nhiên (HD-9A < HD-9B < HD-10)
  const cmpCode = naturalCompareCode(a.equipment_code, b.equipment_code);
  if (cmpCode !== 0) return cmpCode;
  // 4. Cùng máy thì theo mã hàng
  return (a.item_code ?? '').localeCompare(b.item_code ?? '');
}

function naturalCompareCode(a: string, b: string): number {
  // Tách prefix + số + suffix để sort tự nhiên: HD-9A < HD-9B < HD-10
  const ma = a.match(/^([A-Z]+)-?(\d+)([A-Z]*)/i);
  const mb = b.match(/^([A-Z]+)-?(\d+)([A-Z]*)/i);
  if (!ma || !mb) return a.localeCompare(b);
  if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]);
  const na = parseInt(ma[2], 10);
  const nb = parseInt(mb[2], 10);
  if (na !== nb) return na - nb;
  return ma[3].localeCompare(mb[3]);
}
