// Sản lượng COATING hàng ngày (bộ phận CO) — anh Hữu chốt 05/10/2026. Dùng chung API + giao diện.
// Luồng: quét tem LOT xi mạ → catalog (agent kéo từ app chính, lưu Storage plan-files/co-lots.json)
// → dòng phiếu ngày (Supabase co_day_slips/co_day_lines) → Gửi → agent đẩy app chính (lưu vĩnh viễn).

export const CO_MACHINES = ['CO-01', 'CO-02', 'CO-03'] as const;
export const CO_LOTS_BUCKET = 'plan-files';
export const CO_LOTS_PATH = 'co-lots.json';

export type CoLot = {
  lot: string;        // '2610050048' = mã vạch tem
  label: string;      // '261005-0048-NPT'
  vendor: string;
  date: string;       // ngày nhập xi mạ YYYY-MM-DD
  saeji: string;      // SaejiNo 9 số
  saeji_disp: string; // '608-094'
  item: string;
  name: string;
  spec: string;
  kg: number;
  qty: number;
};

export type CoLine = {
  id: string;
  seq_no: number;
  machine: string;
  lot_no: string;
  lot_label: string | null;
  vendor: string | null;
  saeji: string | null;
  item_code: string | null;
  item_name: string | null;
  lot_weight_kg: number | null;
  weight_kg: number;
  lot_qty: number | null;
  employee_id: string | null;
  employee_name: string | null;
  note: string | null;
  matched: boolean;
  created_by_name: string | null;
};

export type CoSlip = {
  id: string;
  uid: string;
  work_date: string;
  status: 'draft' | 'pending' | 'received';
  sent_at: string | null;
  sent_by_name: string | null;
  received_at: string | null;
  last_error: string | null;
};

/** Chuỗi quét/gõ → khoá LOT. Nhận '2610050048', '*2610050048*', '261005-0048', '261005-0048-NPT'. */
export function normalizeLot(text: string): string {
  const t = (text ?? '').trim().replace(/^\*+|\*+$/g, '').toUpperCase().replace(/\s+/g, '');
  const parts = t.split('-').filter(Boolean);
  if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) return parts[0] + parts[1];
  return t.replace(/\D/g, '');
}

export function coUid(date: string): string {
  return `CO-${date.replace(/-/g, '')}`;
}

/** Ai được dùng màn Sản lượng CO: 4 người bộ phận CO (tổ trưởng + nhân viên), admin, qlsx (chỉ xem). */
export function canUseCoDay(s: { role: string; department: string | null } | null): boolean {
  if (!s) return false;
  return s.role === 'admin' || s.role === 'qlsx' || s.department === 'CO';
}
export function canEditCoDay(s: { role: string; department: string | null } | null): boolean {
  if (!s) return false;
  return s.role === 'admin' || (s.department === 'CO' && (s.role === 'leader' || s.role === 'worker'));
}

export function isISODate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Hôm nay theo giờ Việt Nam (Vercel chạy UTC). */
export function vnToday(): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  return d.toISOString().slice(0, 10);
}
