// Phần THUẦN (không đụng Supabase) của máy dừng RL tự chép + nhắc — dùng được cả ở
// component trình duyệt lẫn máy chủ. Mô tả luật: xem lib/stop-carry.ts (anh Hữu 06/11/2026).

export const CARRY_DEPTS = ['RL'] as const;
export const CARRY_PREFIX = 'Tự động từ ';
export const CARRY_WINDOW_DAYS = 10;
export const REMIND_FROM_MIN = 15 * 60 + 30;   // 15:30
export const REMIND_DEADLINE = '16:30';

const DAY_MS = 86400 * 1000;

/** YYYY-MM-DD theo giờ VN của mốc thời gian `ms` (Vercel chạy UTC → +7h). */
export function isoVN(ms: number = Date.now()): string {
  return new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' ± n ngày (lịch thuần, không múi giờ). */
export function addDaysISO(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function isSundayISO(iso: string): boolean {
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
}

/** '2026-11-05' → 'Tự động từ 05/11' */
export function carryLabel(fromISO: string): string {
  return `${CARRY_PREFIX}${fromISO.slice(8, 10)}/${fromISO.slice(5, 7)}`;
}

export function isCarryName(name: string | null | undefined): boolean {
  return (name ?? '').startsWith(CARRY_PREFIX);
}

/** Đến giờ nhắc chưa: từ 15:30 giờ VN, không phải Chủ nhật. */
export function remindDue(ms: number = Date.now()): boolean {
  const d = new Date(ms + 7 * 3600 * 1000);
  if (d.getUTCDay() === 0) return false;
  return d.getUTCHours() * 60 + d.getUTCMinutes() >= REMIND_FROM_MIN;
}
