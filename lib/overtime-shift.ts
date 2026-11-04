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
//     NGOẠI LỆ 04/11/2026: ca chiều ngày thường tổ trưởng chọn được số giờ
//     từng người (3h / 4h / Khác), bắt đầu luôn 16:30 — xem pmPresetFor().
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

// -----------------------------------------------------------------------------
// GIỜ RIÊNG TỪNG NGƯỜI — CA CHIỀU NGÀY THƯỜNG (anh Hữu 04/11/2026)
// Tổ trưởng chọn 3h / 4h / Khác cho từng nhân viên. Giờ bắt đầu cố định 16:30,
// giờ kết thúc = 16:30 + số giờ. "Khác": bước 0,5h, từ 0,5h đến 7h (muộn nhất 23:30).
// Ca sáng và Chủ nhật giữ giờ cố định như cũ — không có lựa chọn này.
// -----------------------------------------------------------------------------

export const PM_HOURS_MIN = 0.5;
export const PM_HOURS_MAX = 7;
/** Hai nút chọn nhanh; còn lại là "Khác". */
export const PM_HOURS_QUICK = [3, 4] as const;

/** Phiếu này có cho chọn giờ riêng từng người không: chỉ ngày thường + ca chiều. */
export function hasPerPersonHours(dayType: string | null | undefined, shift: unknown): boolean {
  return dayType === 'weekday' && normShift(dayType, shift) === 'PM';
}

/** Số giờ hợp lệ: số, bội 0,5, trong [0,5 ; 7]. */
export function isValidPmHours(h: unknown): h is number {
  return (
    typeof h === 'number' && Number.isFinite(h) &&
    h >= PM_HOURS_MIN && h <= PM_HOURS_MAX && Number.isInteger(h * 2)
  );
}

/** Chuỗi tổ trưởng gõ ('3,5' | '3.5' | ' 4 ') → số; không phải số → null. */
export function parseHoursInput(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Giờ ca chiều theo số giờ: 16:30 → 16:30 + h. Không kiểm hợp lệ — gọi isValidPmHours trước. */
export function pmPresetFor(hours: number): Preset {
  const start = PRESETS.weekday.PM.time_from;            // '16:30:00'
  const end = toMinutes(start) + Math.round(hours * 60);
  const hh = String(Math.floor(end / 60)).padStart(2, '0');
  const mm = String(end % 60).padStart(2, '0');
  return { time_from: start, time_to: `${hh}:${mm}:00`, duration_hours: hours };
}

/** 3.5 → '3,5' */
export function hoursText(h: number): string {
  return String(h).replace('.', ',');
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

// -----------------------------------------------------------------------------
// NGÀY ↔ LOẠI NGÀY (anh Hữu 31/10/2026): Chủ nhật thường đăng ký từ hôm trước →
// bấm "Chủ nhật" thì ngày tự nhảy sang Chủ nhật kế tiếp gần nhất. Ngày không khớp
// loại ngày chỉ CẢNH BÁO + hỏi xác nhận (ngày lễ có thể đăng ký loại Chủ nhật).
// -----------------------------------------------------------------------------

/** 'YYYY-MM-DD' hợp lệ (đúng lịch) không. */
export function isISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 'YYYY-MM-DD' là Chủ nhật không (tính theo lịch, không theo múi giờ máy). */
export function isSundayISO(iso: string): boolean {
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
}

/** Chủ nhật gần nhất từ ngày này trở đi: Chủ nhật → giữ nguyên, ngày khác → Chủ nhật kế tiếp. */
export function nextSundayISO(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

/** Câu cảnh báo khi ngày không khớp loại ngày; khớp → null. */
export function dayTypeMismatch(iso: string, dayType: DayType | null | undefined): string | null {
  if (!dayType || !isISODate(iso)) return null;
  const sun = isSundayISO(iso);
  const [y, m, d] = iso.split('-');
  const ngay = `${d}/${m}/${y}`;
  if (dayType === 'sunday' && !sun) return `Ngày ${ngay} không phải Chủ nhật nhưng phiếu đang chọn loại "Chủ nhật".`;
  if (dayType === 'weekday' && sun) return `Ngày ${ngay} là Chủ nhật nhưng phiếu đang chọn loại "Ngày thường".`;
  return null;
}
