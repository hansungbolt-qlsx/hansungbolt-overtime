// Hai luật chặn khi tạo/sửa phiếu tăng ca (anh Hữu 21/10/2026) — chỉ chạy phía server.
//   1) Một bộ phận một ngày tối đa 1 phiếu mỗi ca → phiếu thứ 2 cùng ca bị chặn,
//      muốn thêm/bớt người thì Sửa phiếu cũ.
//   2) Giờ của cùng một người trên 2 phiếu cùng ngày (AM/PM) không được chồng nhau
//      — chồng là giờ công bị tính 2 lần.
import { supabaseAdmin } from '@/lib/supabase';
import { normShift, overlaps, type Shift } from '@/lib/overtime-shift';
import { toTitleCase } from '@/lib/format';

export async function duplicateShiftError(
  date: string,
  department: string,
  shift: Shift,
  excludeRegId?: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, day_type, shift')
    .eq('overtime_date', date)
    .eq('department', department);
  if (error) return error.message;
  const clash = (data ?? []).find(
    (r) => r.id !== excludeRegId && normShift(r.day_type, r.shift) === shift,
  );
  if (!clash) return null;
  const caText = shift === 'AM' ? 'AM (tăng ca sáng)' : 'PM';
  return `Ngày này bộ phận ${department} đã có phiếu ${caText}. Muốn thêm hoặc bớt người, hãy bấm Sửa ở phiếu đó.`;
}

type TimedRow = { employee_id: string; time_from: string; time_to: string };

export async function overlapError(
  date: string,
  rows: TimedRow[],
  excludeRegId?: string,
): Promise<string | null> {
  const empIds = Array.from(new Set(rows.map((r) => r.employee_id)));
  if (empIds.length === 0) return null;

  const { data: regs, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, time_from, time_to')
    .eq('overtime_date', date);
  if (regErr) return regErr.message;
  const others = (regs ?? []).filter((r) => r.id !== excludeRegId);
  if (others.length === 0) return null;

  const regById = new Map(others.map((r) => [r.id, r]));
  const { data: items, error: itErr } = await supabaseAdmin
    .from('overtime_items')
    .select('registration_id, employee_id, time_from, time_to')
    .in('registration_id', others.map((r) => r.id))
    .in('employee_id', empIds);
  if (itErr) return itErr.message;

  for (const row of rows) {
    for (const it of items ?? []) {
      if (it.employee_id !== row.employee_id) continue;
      const rg = regById.get(it.registration_id);
      const from = it.time_from ?? rg?.time_from;
      const to = it.time_to ?? rg?.time_to;
      if (!from || !to) continue;
      if (overlaps(row.time_from, row.time_to, from, to)) {
        const { data: emp } = await supabaseAdmin
          .from('employees')
          .select('full_name')
          .eq('id', row.employee_id)
          .maybeSingle();
        const name = emp?.full_name ? toTitleCase(emp.full_name) : 'Nhân viên';
        return `${name}: giờ ${row.time_from.slice(0, 5)}–${row.time_to.slice(0, 5)} chồng lên giờ ${from.slice(0, 5)}–${to.slice(0, 5)} ở phiếu khác cùng ngày.`;
      }
    }
  }
  return null;
}
