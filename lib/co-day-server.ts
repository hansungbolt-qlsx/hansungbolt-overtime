// Hàm phía server dùng chung cho các route /api/co-days/* (Next.js không cho route.ts xuất hàm phụ).
import { supabaseAdmin } from '@/lib/supabase';
import { CO_LOTS_BUCKET, CO_STAGES, NO_LOT_MSG, coUid, decodeCoLots, normalizeLot, type CoLot, type CoStage } from '@/lib/co-day';

// Catalog LOT xi mạ phía server (anh Hữu 07/10/2026: CO bắt buộc LOT có trong danh sách). Giữ trong bộ nhớ 60 giây
// cho đỡ tải Storage (gói Free); LOT không thấy → tải lại 1 lần (catalog agent đẩy mỗi 10') rồi mới kết luận.
const catCache = new Map<string, { at: number; m: Map<string, CoLot> }>();
async function serverCatalog(stage: CoStage, fresh = false): Promise<Map<string, CoLot> | null> {
  const path = CO_STAGES[stage].lotsPath;
  const c = catCache.get(path);
  if (!fresh && c && Date.now() - c.at < 60_000) return c.m;
  const { data } = await supabaseAdmin.storage.from(CO_LOTS_BUCKET).download(path);
  if (!data) return null;
  try {
    const m = decodeCoLots(JSON.parse(await data.text()));
    catCache.set(path, { at: Date.now(), m });
    return m;
  } catch { return null; }
}
async function findLot(stage: CoStage, key: string): Promise<{ lot?: CoLot; error?: string }> {
  let m = await serverCatalog(stage);
  let lot = m?.get(key);
  if (!lot) { m = await serverCatalog(stage, true); lot = m?.get(key); }
  if (!m || m.size === 0) return { error: 'Chưa có danh sách LOT xi mạ — thử lại sau ít phút' };
  return lot ? { lot } : { error: `${NO_LOT_MSG} (${key}) trong danh sách LOT xi mạ ${CO_STAGES[stage].itemsLabel}, 12 tháng` };
}

export const LINE_COLS =
  'id, seq_no, machine, lot_no, lot_label, vendor, saeji, item_code, item_name, lot_weight_kg, weight_kg, lot_qty, employee_id, employee_name, note, matched, created_by_name';

export type LineIn = {
  machine?: string; lot_no?: string; lot_label?: string | null; vendor?: string | null; saeji?: string | null;
  item_code?: string | null; item_name?: string | null; lot_weight_kg?: number | null; weight_kg?: number;
  lot_qty?: number | null; employee_id?: string | null; note?: string | null; matched?: boolean;
};

/** Kiểm + chuẩn hoá 1 dòng (dùng chung POST và PATCH). */
export async function cleanLine(b: LineIn, stage: CoStage = '86'): Promise<{ row?: Record<string, unknown>; error?: string }> {
  const machine = String(b.machine ?? '').trim();
  const mcs = CO_STAGES[stage].machines;
  if (!mcs.includes(machine)) return { error: `Chưa chọn máy ${mcs.join(' / ')}` };
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
  if (CO_STAGES[stage].requireLot) {
    // Thông tin LOT lấy từ danh sách ERP, không lấy theo điện thoại gửi lên
    const f = await findLot(stage, lot);
    if (!f.lot) return { error: f.error };
    const l = f.lot;
    return {
      row: {
        machine, lot_no: lot, lot_label: l.label, vendor: l.vendor, saeji: l.saeji,
        item_code: l.item, item_name: l.name || null, lot_weight_kg: l.kg, weight_kg: Math.round(kg * 1000) / 1000, lot_qty: l.qty,
        employee_id: b.employee_id, employee_name, note: (b.note ?? '').toString().trim() || null, matched: true,
      },
    };
  }
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

/** Phiếu ngày × công đoạn: tạo nếu chưa có; có thay đổi dòng → về 'draft' + xoá synced_at (bắt buộc Gửi lại). */
export async function ensureDraftSlip(date: string, byName: string, stage: CoStage = '86'): Promise<{ id?: string; error?: string }> {
  const { data: slip } = await supabaseAdmin
    .from('co_day_slips').select('id, status').eq('work_date', date).eq('stage', stage).maybeSingle();
  if (slip) {
    const { error } = await supabaseAdmin.from('co_day_slips')
      .update({ status: 'draft', synced_at: null, updated_at: new Date().toISOString() }).eq('id', slip.id);
    return error ? { error: error.message } : { id: slip.id };
  }
  const { data: ins, error } = await supabaseAdmin.from('co_day_slips')
    .insert({ uid: coUid(date, stage), work_date: date, stage, status: 'draft', created_by_name: byName })
    .select('id').single();
  if (error || !ins) return { error: error?.message ?? 'Không tạo được phiếu' };
  return { id: ins.id };
}


// ── Hàng chờ XOÁ sang app chính (anh Hữu 05/10/2026: xoá ở app tăng ca hay app chính đều được) ──
// Phiếu đã từng về app chính mà bị xoá ở đây → ghi uid vào Storage plan-files/co-deleted.json;
// agent đọc, gọi app chính /api/ot/co-day-delete rồi gỡ uid. Không cần bảng mới (khỏi migration).
const DEL_PATH = 'co-deleted.json';
export type CoDeleted = { uid: string; work_date: string; by: string; at: string };

export async function readCoDeleted(): Promise<CoDeleted[]> {
  const { data } = await supabaseAdmin.storage.from('plan-files').download(DEL_PATH);
  if (!data) return [];
  try { const j = JSON.parse(await data.text()); return Array.isArray(j) ? j : []; } catch { return []; }
}

export async function writeCoDeleted(items: CoDeleted[]): Promise<string | null> {
  const { error } = await supabaseAdmin.storage.from('plan-files')
    .upload(DEL_PATH, Buffer.from(JSON.stringify(items), 'utf8'), { contentType: 'application/json', upsert: true });
  return error ? error.message : null;
}
