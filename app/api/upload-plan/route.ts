import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { expandMachineCode, parseSheet } from '@/lib/parse-plan';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chưa đăng nhập hoặc không có quyền' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const sheetName = form.get('sheet');
  const planDate = form.get('plan_date');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Thiếu file' }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  // Inspect mode: chưa chọn sheet → trả về danh sách sheets
  if (typeof sheetName !== 'string' || !sheetName) {
    return NextResponse.json({ sheets: wb.SheetNames });
  }

  if (typeof planDate !== 'string' || !planDate) {
    return NextResponse.json({ error: 'Thiếu ngày kế hoạch' }, { status: 400 });
  }

  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return NextResponse.json(
      { error: `Không tìm thấy sheet "${sheetName}"` },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = parseSheet(sheet);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi parse sheet';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: knownEqs, error: eqErr } = await supabaseAdmin
    .from('equipments')
    .select('code')
    .eq('department', 'HD');
  if (eqErr) {
    return NextResponse.json({ error: eqErr.message }, { status: 500 });
  }
  const knownCodes = new Set((knownEqs ?? []).map((e) => e.code));

  const records: Array<{
    plan_date: string;
    equipment_code: string;
    item_code: string;
  }> = [];
  const warnings: string[] = [];

  for (const row of parsed) {
    const codes = expandMachineCode(row.machineShort);
    if (codes.length === 0) {
      warnings.push(`Bỏ qua máy "${row.machineShort}" (không parse được)`);
      continue;
    }
    for (const code of codes) {
      if (!knownCodes.has(code)) {
        warnings.push(`Bỏ qua máy "${code}" (không có trong danh sách thiết bị)`);
        continue;
      }
      records.push({
        plan_date: planDate,
        equipment_code: code,
        item_code: row.itemCode,
      });
    }
  }

  const { error: delErr } = await supabaseAdmin
    .from('daily_plans')
    .delete()
    .eq('plan_date', planDate);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (records.length > 0) {
    const { error: insErr } = await supabaseAdmin.from('daily_plans').insert(records);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  const distinctMachines = new Set(records.map((r) => r.equipment_code)).size;

  return NextResponse.json({
    inserted: records.length,
    distinct_machines: distinctMachines,
    warnings,
    plan_date: planDate,
    sheet: sheetName,
  });
}
