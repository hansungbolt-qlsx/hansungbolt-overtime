// Hàm phía server dùng chung cho các route /api/co-days/* (Next.js không cho route.ts xuất hàm phụ).
import { supabaseAdmin } from '@/lib/supabase';
import { CO_MACHINES, coUid, normalizeLot } from '@/lib/co-day';

export const LINE_COLS =
  'id, seq_no, machine, lot_no, lot_label, vendor, saeji, item_code, item_name, lot_weight_kg, weight_kg, lot_qty, employee_id, employee_name, note, matched, created_by_name';

export type LineIn = {
  machine?: string; lot_no?: string; lot_label?: string | null; vendor?: string | null; saeji?: string | null;
  item_code?: string | null; item_name?: string | null; lot_weight_kg?: number | null; weight_kg?: number;
  lot_qty?: number | null; employee_id?: string | null; note?: string | null; matched?: boolean;
};

/** Kiểm + chuẩn hoá 1 dòng (dùng chung POST và PATCH). */
export async function cleanLine(b: LineIn): Promise<{ row?: Record<string, unknown>; error?: string }> {
  const machine = String(b.machine ?? '').trim();
  if (!(CO_MACHINES as readonly string[]).includes(machine)) return { error: 'Chưa chọn máy CO-01 / CO-02 / CO-03' };
  const lot = normalizeLot(String(b.lot_no ?? ''));
  if (lot.length < 6) return { error: 'LOT NO không hợp lệ' };
  const kg = Number(b.weight_kg);
  if (!Number.isFinite(kg) || kg <= 0) return { error: 'Trọng lượng phải lớn hơn 0' };
  let employee_name: string | null = null;
  if (b.employee_id) {
    const { data: emp } = await supabaseAdmin
      .from('employees').select('full_name, department').eq('id', b.employee_id).maybeSingle();
    if (!emp || emp.department !== 'CO') return { error: 'Nhân viên không thuộc bộ phận Coating' };
    employee_name = emp.full_name;
  } else {
    return { error: 'Chưa chọn nhân viên' };
  }
  const num = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    row: {
      machine, lot_no: lot,
      lot_label: b.lot_label ?? null, vendor: b.vendor ?? null, saeji: b.saeji ?? null,
      item_code: (b.item_code ?? '').toString().trim() || null, item_name: b.item_name ?? null,
      lot_weight_kg: num(b.lot_weight_kg), weight_kg: Math.round(kg * 1000) / 1000, lot_qty: num(b.lot_qty),
      employee_id: b.employee_id, employee_name, note: (b.note ?? '').toString().trim() || null,
      matched: b.matched !== false,
    },
  };
}

/** Phiếu ngày: tạo nếu chưa có; có thay đổi dòng → về 'draft' + xoá synced_at (bắt buộc Gửi lại). */
export async function ensureDraftSlip(date: string, byName: string): Promise<{ id?: string; error?: string }> {
  const { data: slip } = await supabaseAdmin
    .from('co_day_slips').select('id, status').eq('work_date', date).maybeSingle();
  if (slip) {
    const { error } = await supabaseAdmin.from('co_day_slips')
      .update({ status: 'draft', synced_at: null, updated_at: new Date().toISOString() }).eq('id', slip.id);
    return error ? { error: error.message } : { id: slip.id };
  }
  const { data: ins, error } = await supabaseAdmin.from('co_day_slips')
    .insert({ uid: coUid(date), work_date: date, status: 'draft', created_by_name: byName })
    .select('id').single();
  if (error || !ins) return { error: error?.message ?? 'Không tạo được phiếu' };
  return { id: ins.id };
}

