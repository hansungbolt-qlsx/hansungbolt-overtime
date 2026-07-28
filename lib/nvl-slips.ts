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
};

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
};
