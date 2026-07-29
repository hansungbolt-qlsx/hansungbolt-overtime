// Dùng chung cho luồng Xuất / Trả kho NPL từ app tăng ca (28/07/2026).
// Spec: hsb-material-app/docs/SPEC_OT_XUAT_TRA_KHO.md

export const KINDS = ['issue', 'return'] as const;
export const BRANCHES = ['nvl', 'aux'] as const;
export type Kind = (typeof KINDS)[number];
export type Branch = (typeof BRANCHES)[number];

export const KIND_LABEL: Record<Kind, string> = { issue: 'Xuất kho', return: 'Trả kho' };
export const BRANCH_LABEL: Record<Branch, string> = { nvl: 'Nguyên liệu', aux: 'Phụ liệu' };

export const DEPARTMENTS = ['Heading', 'Rolling'] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** Server Vercel chạy UTC → phải quy +7h rồi mới lấy ngày/giờ VN.
 *  (Quy tắc dự án: xem PROJECT_CONTEXT — new Date() trên server = UTC.) */
export function todayVN(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function nowVNTime(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);
}

/** Khoá idempotent gửi sang app chính. Cùng uid = ghi đè bản đang chờ duyệt. */
export function slipUid(date: string, kind: Kind, branch: Branch, seq: number): string {
  return `ot-${date}-${kind}-${branch}-${seq}`;
}

/** Bộ phận mặc định theo spec mục 5 (user chốt 28/7).
 *  Nguyên liệu → Heading · Phụ liệu → Rolling.
 *  Riêng DẦU: 46HS và 527V thuộc Heading, chỉ 322 mới là Rolling. */
export function defaultDepartment(branch: Branch, code: string, name = ''): Department {
  const s = `${code} ${name}`.toUpperCase();
  if (s.includes('46HS') || s.includes('527V')) return 'Heading';
  if (s.includes('322')) return 'Rolling';
  return branch === 'nvl' ? 'Heading' : 'Rolling';
}

// ===========================================================================
// Ô GỢI Ý MÃ — khớp kiểu "tên dính cỡ" (user chốt 29/7)
//
// Nhân viên kho quen gõ liền: `18A320` · `SCM545` · `STS430320` · `430320`.
// Trước đây chỉ so chuỗi con trên "code + tên + cỡ" nên mấy kiểu này ra 0 kết quả.
//
// Mẹo: MÃ NVL đã mã hoá sẵn cỡ ở 4 số cuối — 3.2 → `0320`, 5.45 → `0545`.
// Nên quy cỡ về 4 chữ số rồi so là khớp được cả `320`, `0320`, `32`.
// ===========================================================================

/** Bỏ mọi ký tự không phải chữ/số + hoa hoá. '104300-3000-2F' → '10430030002F' */
export function normSearch(s: unknown): string {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Cỡ NVL → 4 chữ số theo đúng quy luật mã: 3.2 → '0320' · 5.45 → '0545' · 16 → '1600' */
export function sizeKey(size: unknown): string {
  const n = Number(String(size ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.round(n * 100)).padStart(4, '0');
}

/** Mã NVL có khớp ô tìm không. Kiểm chứng trên 331 mã thật ngày 29/7. */
export function matchNvl(q: string, code: unknown, name: unknown, size: unknown): boolean {
  const s = normSearch(q);
  if (!s) return false;
  const c = normSearch(code);
  const n = normSearch(name);
  const k = sizeKey(size);
  // 1) cách cũ — gõ mã, gõ tên, gõ cỡ
  if (c.includes(s) || n.includes(s) || (k !== '' && k.includes(s))) return true;
  // 2) "tên + cỡ dính liền": thử tách đuôi 4 / 3 / 2 chữ số làm cỡ
  //    ⚠ PHẢI thử CẢ BA. Chỉ thử một kiểu là 'STS304320' trượt (đã dính lúc thử).
  for (const L of [4, 3, 2]) {
    if (s.length <= L) continue;
    const d = s.slice(-L);
    if (!/^\d+$/.test(d)) continue;
    const head = s.slice(0, -L);
    if (k !== '' && k.includes(d) && (n.includes(head) || c.includes(head))) return true;
  }
  return false;
}

/** Mã phụ liệu — chỉ bỏ dấu câu (mã PL không mã hoá cỡ như NVL). */
export function matchAux(q: string, ...fields: unknown[]): boolean {
  const s = normSearch(q);
  if (!s) return false;
  return fields.some((f) => normSearch(f).includes(s));
}

// LÝ DO TRẢ KHO (user chốt 29/7) — gắn theo TỪNG DÒNG, không phải cả phiếu.
// Chuỗi lưu xuống DB đúng nguyên văn dưới đây; 'Khác' thì lưu nội dung user gõ.
export const RETURN_REASONS = [
  'Sản xuất dư - trả kho',
  'NVL lỗi - Trả kho',
] as const;
export const RETURN_REASON_DEFAULT = RETURN_REASONS[0];
export const RETURN_REASON_OTHER = 'Khác';

export type StockCoil = {
  id: number;
  coil_no: string;
  lot_no: string;
  kg: number;
  code: string;
  name: string;
  size: string;
  received_at?: string | null;   // ngày nhập kho — hiện kèm vì list xếp theo Kg
  issued_at: string | null;      // ngày xuất ra line (dùng khi TRẢ kho)
  // NCC của cuộn (app chính suy từ cuộn → phiếu nhập). Rỗng = phiếu nhập tay chưa
  // ghi NCC. Có từ STOCK_PAYLOAD_V=3; snapshot cũ chưa có field này → undefined.
  supplier?: string;
};

// Viết tắt NCC — user quy ước 28/7 để mỗi cuộn LUÔN nằm gọn 1 dòng trên điện
// thoại ("DAEHO  STEEL" dài 12 ký tự làm dòng xuống hàng).
// So khớp sau khi bỏ dấu tiếng Việt nên không phụ thuộc cách ERP gõ dấu.
const SUP_SHORT: Array<[RegExp, string]> = [
  [/DAEHO/, 'DH'],                    // DAEHO  STEEL
  [/VINH\s*THANH/, 'VT'],             // VĨNH THÀNH
  [/NHUAN\s*THAI/, 'NT'],             // NHUẬN THÁI
  [/KOS/, 'KOS'],                     // KOS VIỆT NAM
  [/HANSUNGBOLT|HANSUNG/, 'Korea'],   // HANSUNGBOLT KOREA
  [/DONG\s*BANG/, 'DB'],              // DONG BANG
  [/POS[\s-]*SEAH/, 'POS'],           // POS-SEAH
];

/** Tên NCC → nhãn ngắn hiện trên dòng cuộn. NCC mới chưa quy ước → chữ đầu mỗi từ. */
export function supShort(name?: string | null): string {
  const s = (name || '').trim();
  if (!s) return '';
  const plain = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toUpperCase();
  for (const [re, short] of SUP_SHORT) if (re.test(plain)) return short;
  const w = plain.split(/[\s.\-_/]+/).filter(Boolean);
  return (w.length > 1 ? w.map((x) => x[0]).join('') : plain).slice(0, 5);
}

export type StockAux = {
  id: number;
  code: string;
  name: string;
  material: string;
  spec: string;
  unit: string;
  stock: number;
};

export type SlipLine = {
  id?: string;
  batch_seq: number;
  batch_time: string;
  batch_user: string;
  department: Department;
  material_code: string;
  material_name?: string | null;
  material_spec?: string | null;
  coil_id?: number | null;
  coil_no?: string | null;
  lot_no?: string | null;
  qty: number;
  unit: string;
  note?: string | null;
  // Lý do TRẢ kho của riêng dòng này (migration 18). Rỗng/NULL = mặc định.
  // Phiếu xuất kho luôn để trống.
  reason?: string | null;
};
