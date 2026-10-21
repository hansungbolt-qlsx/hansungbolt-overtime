// =============================================================================
// CA TĂNG CA — AM (sáng) / PM (chiều) — anh Hữu 21/10/2026. NƠI DUY NHẤT của
// giờ mặc định + giờ tính sản lượng; mọi route/form tăng ca gọi từ đây.
//
// Luật anh chốt:
//   - Ngày thường: PM 16:30–19:30 (3h, MẶC ĐỊNH) · AM 06:00–07:30 (1,5h).
//   - Chủ nhật: 06:00–14:00 (8h), không chia ca → lưu shift = 'PM'.
//   - AM và PM là 2 phiếu riêng, in 2 tờ riêng; một bộ phận một ngày tối đa
//     1 phiếu mỗi ca (chặn phiếu thứ 2 — muốn thêm người thì Sửa phiếu cũ).
//   - Giờ tính sản lượng: AM tính đủ giờ (không trừ nghỉ); PM + Chủ nhật trừ
//     0,5h nghỉ (3h → 2,5h · 8h → 7,5h) — y như trước.
//   - Chỉ admin sửa giờ từng dòng; tổ trưởng chỉ đăng ký giờ mặc định.
// =============================================================================

export type DayType = 'weekday' | 'sunday';
export type Shift = 'AM' | 'PM';

export const MORNING_NOTE = 'Tăng ca sáng';

const PRESETS = {
  weekday: {
    AM: { time_from: '06:00:00', time_to: '07:30:00', duration_hours: 1.5 },
    PM: { time_from: '16:30:00', time_to: '19:30:00', duration_hours: 3 },
  },
  sunday: { time_from: '06:00:00', time_to: '14:00:00', duration_hours: 8 },
} as const;

export type Preset = { time_from: string; time_to: string; duration_hours: number };

/** Ca thật sự lưu: Chủ nhật luôn PM; giá trị lạ/thiếu → PM (phiếu cũ). */
export function normShift(dayType: string | null | undefined, shift: unknown): Shift {
  if (dayType === 'sunday') return 'PM';
  return shift === 'AM' ? 'AM' : 'PM';
}

export function presetOf(dayType: DayType, shift: Shift): Preset {
  return dayType === 'sunday' ? PRESETS.sunday : PRESETS.weekday[shift];
}

/** Giờ dùng tính SL dự kiến từ số giờ tăng ca: AM đủ giờ, còn lại trừ 0,5h nghỉ. */
export function qtyHoursOf(durationHours: number, shift: Shift): number {
  return shift === 'AM' ? Math.max(0, durationHours) : Math.max(0, durationHours - 0.5);
}

/** Nhãn ngắn cho giao diện. */
export function shiftLabel(dayType: string, shift: unknown): string {
  if (dayType === 'sunday') return 'Chủ nhật';
  return normShift(dayType, shift) === 'AM' ? 'Ngày thường · AM' : 'Ngày thường · PM';
}

/** '06:00:00' | '06:00' → '06:00 – 07:30 (1,5h)' */
export function presetText(p: Preset): string {
  const hm = (t: string) => t.slice(0, 5);
  return `${hm(p.time_from)} – ${hm(p.time_to)} (${String(p.duration_hours).replace('.', ',')}h)`;
}

/** Phút trong ngày của 'HH:MM[:SS]'. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Hai khoảng [a1,a2) và [b1,b2) có chồng nhau không (chạm mép không tính). */
export function overlaps(a1: string, a2: string, b1: string, b2: string): boolean {
  return toMinutes(a1) < toMinutes(b2) && toMinutes(b1) < toMinutes(a2);
}
