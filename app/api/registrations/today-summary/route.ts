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

  // Load phiếu cả 2 bộ phận cho ngày đó
  const { data: regs, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department')
    .eq('overtime_date', date);
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  if (!regs || regs.length === 0) {
    return NextResponse.json({ date, departments: { HD: [], RL: [] } });
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

  return NextResponse.json({ date, departments: { HD: hd, RL: rl } });
}
