// MÁY DỪNG RL — TỰ CHÉP DANH SÁCH HÔM TRƯỚC + NHẮC TỔ TRƯỞNG (anh Hữu duyệt 06/11/2026)
//
// RL (gồm máy RL · SM · CT, bộ phận 'RL') không có KHSX để điền sẵn như HD, nên:
//   · NGÀY MỚI tự lấy danh sách máy dừng của NGÀY GẦN NHẤT trước đó (trong 10 ngày) mà
//     RL có dòng: máy đang dừng (chưa bỏ) được chép sang, giữ nguyên lý do,
//     người ghi = "Tự động từ DD/MM". Tổ trưởng chỉ đổi trạng thái khi máy chạy lại
//     ("Máy có chạy — bỏ").
//   · CHỈ chép máy CHƯA có dòng của hôm nay (kể cả dòng đã bỏ) — không bao giờ đè bản
//     tổ trưởng ghi; chèn kiểu ON CONFLICT DO NOTHING nên 2 người mở cùng lúc không trùng.
//   · Không chép vào Chủ nhật (giờ VN).
//   · Tổ trưởng sửa/bỏ máy ở NGÀY NGUỒN sau khi đã chép (vd. sáng nay sửa danh sách hôm
//     qua) → dòng tự chép hôm nay của máy đó (nếu tổ trưởng chưa đụng) đi theo.
// Nhắc: từ 15:30, hạn 16:00 (giờ VN, trừ Chủ nhật) tổ trưởng RL chưa mở tab Máy dừng hôm nay →
// chấm đỏ trên tab + băng đỏ đầu trang; mở tab là tắt (ghi nhớ trên máy, theo ngày).
import { supabaseAdmin } from '@/lib/supabase';
import {
  CARRY_DEPTS,
  CARRY_WINDOW_DAYS,
  addDaysISO,
  carryLabel,
  isSundayISO,
} from '@/lib/stop-carry-shared';

export {
  CARRY_DEPTS,
  CARRY_PREFIX,
  CARRY_WINDOW_DAYS,
  REMIND_FROM_MIN,
  REMIND_DEADLINE,
  isoVN,
  addDaysISO,
  isSundayISO,
  carryLabel,
  isCarryName,
  remindDue,
} from '@/lib/stop-carry-shared';

type SrcRow = {
  stop_date: string;
  machine_code: string;
  reason_code: string | null;
  reason_text: string | null;
  dismissed: boolean | null;
};

/** Mã máy thật (không phải máy ảo OTHER) của bộ phận RL → bộ phận. */
async function carryMachines(): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('equipments')
    .select('code, department, machine_type')
    .in('department', [...CARRY_DEPTS]);
  if (error) throw new Error(error.message);
  const out = new Map<string, string>();
  for (const e of data ?? []) {
    if (e.machine_type !== 'OTHER' && e.code) out.set(e.code, e.department);
  }
  return out;
}

/**
 * Chép danh sách máy dừng RL sang ngày `today` (YYYY-MM-DD giờ VN). Trả số dòng thêm.
 * Lỗi → ném ra để nơi gọi tự bỏ qua (không được làm hỏng việc xem danh sách).
 */
export async function carryForward(today: string): Promise<{ inserted: number; from: string | null }> {
  if (isSundayISO(today)) return { inserted: 0, from: null };
  const machines = await carryMachines();
  if (!machines.size) return { inserted: 0, from: null };
  const codes = [...machines.keys()];

  // Dòng RL trong cửa sổ 10 ngày trước hôm nay (kể cả dòng đã bỏ — ngày nào RL có dòng
  // dù đã bỏ hết vẫn là ngày nguồn, để không lôi máy dừng cũ hơn sống lại)
  const { data: win, error: wErr } = await supabaseAdmin
    .from('machine_stop_reasons')
    .select('stop_date, machine_code, reason_code, reason_text, dismissed')
    .in('machine_code', codes)
    .gte('stop_date', addDaysISO(today, -CARRY_WINDOW_DAYS))
    .lt('stop_date', today);
  if (wErr) throw new Error(wErr.message);
  const rows = (win ?? []) as SrcRow[];
  if (!rows.length) return { inserted: 0, from: null };
  const from = rows.reduce((m, r) => (r.stop_date > m ? r.stop_date : m), rows[0].stop_date);

  const { data: cur, error: cErr } = await supabaseAdmin
    .from('machine_stop_reasons')
    .select('machine_code')
    .eq('stop_date', today)
    .in('machine_code', codes);
  if (cErr) throw new Error(cErr.message);
  const taken = new Set((cur ?? []).map((r: { machine_code: string }) => r.machine_code));

  const ins = rows
    .filter((r) => r.stop_date === from && !r.dismissed && r.reason_code && !taken.has(r.machine_code))
    .map((r) => ({
      stop_date: today,
      machine_code: r.machine_code,
      department: machines.get(r.machine_code),
      reason_code: r.reason_code,
      reason_text: r.reason_text,
      created_by: null,
      created_by_name: carryLabel(from),
      dismissed: false,
    }));
  if (!ins.length) return { inserted: 0, from };
  const { error } = await supabaseAdmin
    .from('machine_stop_reasons')
    .upsert(ins, { onConflict: 'stop_date,machine_code', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return { inserted: ins.length, from };
}

/**
 * Tổ trưởng vừa sửa/bỏ máy `machine` ở ngày `date` (< hôm nay). Nếu hôm nay máy đó còn
 * dòng TỰ CHÉP TỪ ĐÚNG NGÀY `date` (tổ trưởng chưa đụng) → cho dòng hôm nay đi theo.
 * reason = null → bỏ; ngược lại đổi lý do (giữ nhãn tự chép). Trả true nếu có đổi.
 */
export async function followSource(
  date: string,
  machine: string,
  today: string,
  reason: { code: string; text: string | null } | null,
): Promise<boolean> {
  if (date >= today) return false;
  const { data: row, error } = await supabaseAdmin
    .from('machine_stop_reasons')
    .select('machine_code, created_by, created_by_name, dismissed')
    .eq('stop_date', today)
    .eq('machine_code', machine)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || row.dismissed || row.created_by || row.created_by_name !== carryLabel(date)) return false;
  const patch = reason
    ? { reason_code: reason.code, reason_text: reason.text, updated_at: new Date().toISOString() }
    : { dismissed: true, updated_at: new Date().toISOString() };
  const { error: uErr } = await supabaseAdmin
    .from('machine_stop_reasons')
    .update(patch)
    .eq('stop_date', today)
    .eq('machine_code', machine);
  if (uErr) throw new Error(uErr.message);
  return true;
}
