// Sản lượng COATING hàng ngày (bộ phận CO) — anh Hữu chốt 05/10/2026. Dùng chung API + giao diện.
// Luồng: quét tem LOT xi mạ → catalog (agent kéo từ app chính, lưu Storage plan-files/co-lots.json)
// → dòng phiếu ngày (Supabase co_day_slips/co_day_lines) → Gửi → agent đẩy app chính (lưu vĩnh viễn).

export const CO_MACHINES = ['CO-01', 'CO-02', 'CO-03'] as const;
export const CO_LOTS_BUCKET = 'plan-files';
export const CO_LOTS_PATH = 'co-lots.json';

// Công đoạn dùng chung bảng co_day_* (anh Hữu 06/10/2026): '86' Coating · '84' A/B (máy mặc định AB-01).
// Mã A/B app chính tự lấy từ ERP (mã có CĐ 84 + xi mạ 80) → catalog riêng ab-lots.json.
export type CoStage = '86' | '84';
// requireLot (anh Hữu 07/10/2026): CO BẮT BUỘC quét được LOT xi mạ có trong danh sách mới nhập tiếp; LOT không có → chặn,
// báo "Không có LOT này" (client + server). AB vẫn cho gõ tay (12 tháng chỉ ~14 LOT xi mạ, nhiều tem phải gõ tay).
export const CO_STAGES: Record<CoStage, {
  short: string; title: string; uidPrefix: string; machines: readonly string[]; lotsPath: string; itemsLabel: string; requireLot: boolean;
}> = {
  '86': { short: 'CO', title: 'Sản lượng CO', uidPrefix: 'CO', machines: CO_MACHINES, lotsPath: CO_LOTS_PATH, itemsLabel: 'mã Coating', requireLot: true },
  '84': { short: 'AB', title: 'Sản lượng AB', uidPrefix: 'AB', machines: ['AB-01'], lotsPath: 'ab-lots.json', itemsLabel: 'mã A/B công đoạn 84', requireLot: false },
};
export const NO_LOT_MSG = 'Không có LOT này';
/** Giá trị lạ / thiếu → '86' (phiếu trước 06/10 là Coating). */
export function parseStage(v: unknown): CoStage {
  return String(v ?? '').trim() === '84' ? '84' : '86';
}

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
  g_ea: number;       // trọng lượng thành phẩm 1 EA (g) — ERP Good.gdanjung, 0 = chưa có (06/10/2026)
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
  stage?: CoStage;
  status: 'draft' | 'pending' | 'received';
  sent_at: string | null;
  sent_by_name: string | null;
  received_at: string | null;
  last_error: string | null;
};

/** Catalog GỌN (v2, 05/10/2026) → Map lot → CoLot. items = [[mã, tên, quy cách, g/EA (06/10)]];
 *  lots = [[lot, NCC, SaejiNo, chỉ_số_mã, kg, ea]]. Nhận cả bản cũ (lots là object). */
export function decodeCoLots(j: unknown): Map<string, CoLot> {
  const m = new Map<string, CoLot>();
  const o = (j ?? {}) as { items?: [string, string, string, number?][]; lots?: unknown[] };
  const items = Array.isArray(o.items) ? o.items : [];
  for (const raw of Array.isArray(o.lots) ? o.lots : []) {
    if (Array.isArray(raw)) {
      const [lot, vendor, saeji, ii, kg, qty] = raw as [string, string, string, number, number, number];
      const it = items[ii] ?? ['', '', '', 0];
      const d6 = lot.slice(0, 6);
      m.set(lot, {
        lot, label: `${d6}-${lot.slice(6)}-${vendor}`, vendor,
        date: `20${d6.slice(0, 2)}-${d6.slice(2, 4)}-${d6.slice(4, 6)}`,
        saeji, saeji_disp: saeji.length >= 6 ? `${saeji.slice(-6, -3)}-${saeji.slice(-3)}` : saeji,
        item: it[0], name: it[1], spec: it[2], kg: Number(kg) || 0, qty: Number(qty) || 0, g_ea: Number(it[3]) || 0,
      });
    } else if (raw && typeof raw === 'object' && 'lot' in raw) {
      const l = raw as CoLot; m.set(l.lot, l);
    }
  }
  return m;
}

/** Chuỗi quét/gõ → khoá LOT. Nhận '2610050048', '*2610050048*', '261005-0048', '261005-0048-NPT'. */
export function normalizeLot(text: string): string {
  const t = (text ?? '').trim().replace(/^\*+|\*+$/g, '').toUpperCase().replace(/\s+/g, '');
  const parts = t.split('-').filter(Boolean);
  if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) return parts[0] + parts[1];
  return t.replace(/\D/g, '');
}

export function coUid(date: string, stage: CoStage = '86'): string {
  return `${CO_STAGES[stage].uidPrefix}-${date.replace(/-/g, '')}`;
}

/** Bảng mã → g/EA từ catalog (items[i][3]); dùng cho Tổng hợp sản lượng (06/10/2026). */
export function unitWeights(j: unknown): Map<string, number> {
  const m = new Map<string, number>();
  const items = ((j ?? {}) as { items?: unknown[] }).items;
  for (const it of Array.isArray(items) ? items : []) {
    if (Array.isArray(it) && typeof it[0] === 'string' && Number(it[3]) > 0) m.set(it[0].toUpperCase(), Number(it[3]));
  }
  return m;
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
/** Gửi phiếu cuối ngày sang app chính: CHỈ tổ trưởng CO (+ admin) — anh Hữu 06/10/2026: tổ viên chỉ quét nhập,
 *  tổ trưởng kiểm tra rồi gửi. Quên gửi thì agent vẫn tự đẩy 07:00 sáng hôm sau. */
export function canSendCoDay(s: { role: string; department: string | null } | null): boolean {
  if (!s) return false;
  return s.role === 'admin' || (s.department === 'CO' && s.role === 'leader');
}
/** Xoá CẢ phiếu ngày: cũng CHỈ tổ trưởng CO (+ admin) — anh Hữu 06/10/2026. Tổ viên vẫn xoá được từng dòng. */
export const canDeleteCoDaySlip = canSendCoDay;

export function isISODate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Hôm nay theo giờ Việt Nam (Vercel chạy UTC). */
export function vnToday(): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  return d.toISOString().slice(0, 10);
}
