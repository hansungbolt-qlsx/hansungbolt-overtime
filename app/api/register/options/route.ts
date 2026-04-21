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

  type MachineWithItems = {
    id: string;
    code: string;
    rpm: number;
    spec: string;
    items: Array<{ item_code: string; item_name: string | null }>;
  };

  let machines: MachineWithItems[] = [];

  if (session.department === 'HD') {
    // HD: chỉ hiện máy có trong kế hoạch của ngày đó + item_code auto từ plan
    const { data: plans, error: planErr } = await supabaseAdmin
      .from('daily_plans')
      .select('equipment_code, item_code, item_name')
      .eq('plan_date', date);
    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });

    const planCodes = Array.from(new Set((plans ?? []).map((p) => p.equipment_code)));
    const itemsByCode: Record<string, Array<{ item_code: string; item_name: string | null }>> = {};
    for (const p of plans ?? []) {
      if (!itemsByCode[p.equipment_code]) itemsByCode[p.equipment_code] = [];
      if (!itemsByCode[p.equipment_code].some((x) => x.item_code === p.item_code)) {
        itemsByCode[p.equipment_code].push({ item_code: p.item_code, item_name: p.item_name });
      }
    }

    if (planCodes.length > 0) {
      const { data: eqs, error: eqErr } = await supabaseAdmin
        .from('equipments')
        .select('id, code, rpm, spec')
        .eq('department', 'HD')
        .neq('machine_type', 'OTHER')
        .in('code', planCodes);
      if (eqErr) return NextResponse.json({ error: eqErr.message }, { status: 500 });
      machines = (eqs ?? [])
        .map((eq) => ({ ...eq, items: itemsByCode[eq.code] ?? [] }))
        .sort((a, b) => hdNaturalCompare(a.code, b.code));
    }
  } else {
    // RL: hiện toàn bộ máy (RL/SM/CT), không lọc theo kế hoạch; mã hàng tổ trưởng nhập tay
    const { data: eqs, error: eqErr } = await supabaseAdmin
      .from('equipments')
      .select('id, code, rpm, spec')
      .eq('department', session.department)
      .neq('machine_type', 'OTHER');
    if (eqErr) return NextResponse.json({ error: eqErr.message }, { status: 500 });
    machines = (eqs ?? [])
      .map((eq) => ({ ...eq, items: [] }))
      .sort((a, b) => rlNaturalCompare(a.code, b.code));
  }

  return NextResponse.json({ employees: emps ?? [], machines });
}

// Sort HD: HD-01, HD-1A, HD-02, ..., HD-M4 (6EA), HD-M3 (6EA)
function hdNaturalKey(code: string): [number, number, string] {
  const grp = code.match(/^HD-M(\d+)/i);
  if (grp) return [2, -parseInt(grp[1], 10), code];
  const m = code.match(/^HD-(\d+)([A-Z]*)$/i);
  if (m) return [1, parseInt(m[1], 10), m[2].toUpperCase()];
  return [3, 0, code];
}

function hdNaturalCompare(a: string, b: string): number {
  const [ka1, ka2, ka3] = hdNaturalKey(a);
  const [kb1, kb2, kb3] = hdNaturalKey(b);
  if (ka1 !== kb1) return ka1 - kb1;
  if (ka2 !== kb2) return ka2 - kb2;
  return ka3.localeCompare(kb3);
}

// Sort RL: nhóm RL- trước, đến SM-, rồi CT-, trong nhóm sort theo số
function rlNaturalKey(code: string): [number, number, string] {
  const prefixOrder: Record<string, number> = { RL: 1, SM: 2, CT: 3 };
  const m = code.match(/^([A-Z]+)-(\d+)([A-Z]*)$/i);
  if (!m) return [9, 0, code];
  const group = prefixOrder[m[1].toUpperCase()] ?? 8;
  return [group, parseInt(m[2], 10), m[3].toUpperCase()];
}

function rlNaturalCompare(a: string, b: string): number {
  const [ka1, ka2, ka3] = rlNaturalKey(a);
  const [kb1, kb2, kb3] = rlNaturalKey(b);
  if (ka1 !== kb1) return ka1 - kb1;
  if (ka2 !== kb2) return ka2 - kb2;
  return ka3.localeCompare(kb3);
}
