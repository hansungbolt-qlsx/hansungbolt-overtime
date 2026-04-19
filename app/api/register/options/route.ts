import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'leader' || !session.department) {
    return NextResponse.json({ error: 'Chưa đăng nhập hoặc không có quyền' }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Thiếu tham số date' }, { status: 400 });
  }

  const { data: emps, error: empErr } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, order_no')
    .eq('department', session.department)
    .order('order_no', { ascending: true });
  if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

  const { data: plans, error: planErr } = await supabaseAdmin
    .from('daily_plans')
    .select('equipment_code')
    .eq('plan_date', date);
  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });

  const planCodes = Array.from(new Set((plans ?? []).map((p) => p.equipment_code)));

  let machines: Array<{ id: string; code: string; rpm: number; spec: string }> = [];
  if (planCodes.length > 0) {
    const { data: eqs, error: eqErr } = await supabaseAdmin
      .from('equipments')
      .select('id, code, rpm, spec')
      .eq('department', session.department)
      .in('code', planCodes)
      .order('code', { ascending: true });
    if (eqErr) return NextResponse.json({ error: eqErr.message }, { status: 500 });
    machines = eqs ?? [];
  }

  return NextResponse.json({
    employees: emps ?? [],
    machines,
  });
}
