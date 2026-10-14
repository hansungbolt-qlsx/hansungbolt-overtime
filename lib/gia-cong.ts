// Nhập liệu GIA CÔNG 70/80 trên điện thoại — CHỈ tài khoản qlsx (anh Hữu chốt 14/10/2026).
// Phiếu ĐẶT: chọn công đoạn + nhà gia công → quét phiếu di chuyển (DCCD, Code39 = số chỉ thị) → gõ kg (số NGUYÊN,
// ERP chỉ lưu kg nguyên) → Lưu / Gửi. Phiếu NHẬP: quét DCCD → tích thùng đang chờ về → kg về (mặc định = kg đặt còn
// chờ) → Hoàn thành mặc định 1 (giao thiếu còn nợ thì sửa 0). Gửi → agent → app chính (huu duyệt, Đẩy ERP).
// Bảng: gc_slips (docs/sql/26-gia-cong.sql). Danh sách chỉ thị / thùng: plan-files/gc-guong.json (agent đẩy khi đổi).

export type GcLoai = 'dat' | 'nhap';
export type GcCongDoan = '70' | '80';
export type GcStatus = 'draft' | 'pending' | 'approved' | 'pushed' | 'rejected';

export const GC_CONG_DOAN: Record<GcCongDoan, string> = { '70': '70 · Xử lý nhiệt', '80': '80 · Xi mạ' };
export const GC_LOAI: Record<GcLoai, string> = { dat: 'Phiếu đặt hàng gia công', nhap: 'Phiếu nhập kho gia công' };
export const GC_GUONG_BUCKET = 'plan-files';
export const GC_GUONG_PATH = 'gc-guong.json';

export type GcLine = {
  saeji_no: string;
  ma_hang: string;
  ten_hang?: string;
  kg: number;
  dat_no?: string;       // phiếu nhập: dòng đặt ERP được tích
  dat_seq?: string;
  kg_dat?: number;       // phiếu nhập: kg đặt / đã về (để hiện + cảnh báo)
  kg_da_ve?: number;
  hoan_thanh?: 0 | 1;
};

export type GcSlip = {
  id: string;
  uid: string;
  loai: GcLoai;
  cong_doan: GcCongDoan;
  ncc: string;
  status: GcStatus;
  lines: GcLine[];
  note: string | null;
  created_by_name: string | null;
  sent_at: string | null;
  synced_at: string | null;
  last_error: string | null;
  reject_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  erp_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type GcGuong = {
  at?: string;
  ncc: Array<{ ma: string; ten: string; cong_doan: GcCongDoan; dat_cuoi: string }>;
  cho_dat: Array<{ saeji_no: string; cong_doan: GcCongDoan; ma_hang: string; ten_hang: string; vao: number; da_dat: number }>;
  cho_ve: Array<{ dat_no: string; dat_seq: string; ncc: string; cong_doan: GcCongDoan; saeji_no: string; ma_hang: string;
    ten_hang: string; kg_dat: number; kg_da_ve: number; ngay_dat: string }>;
};

export const GC_STATUS_UI: Record<GcStatus, { label: string; cls: string }> = {
  draft: { label: '📝 Đang lập', cls: 'bg-slate-100 text-slate-700' },
  pending: { label: '📤 Đã gửi — chờ duyệt', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: '✅ Đã duyệt — chờ đẩy ERP', cls: 'bg-emerald-100 text-emerald-800' },
  pushed: { label: '🏭 Đã lên ERP', cls: 'bg-brand-navy/10 text-brand-navy' },
  rejected: { label: '↩ Bị trả lại — sửa rồi gửi lại', cls: 'bg-red-100 text-red-700' },
};

export function canUseGiaCong(role: string | undefined | null): boolean {
  return role === 'qlsx' || role === 'admin';
}

/** Mã vạch phiếu di chuyển → số chỉ thị 9 số (bỏ '*', bỏ gạch; '608-094' / '202608094' đều ra '202608094'). */
export function normalizeSaeji(text: string): string {
  const d = String(text || '').replace(/\*/g, '').trim().replace(/[^0-9]/g, '');
  if (d.length === 9) return d;
  if (d.length === 6) return `202${d}`;          // '608094' (in trên phiếu dạng 608-094) → 202608094
  return d;
}

export function hienSaeji(s: string): string {
  return s && s.length >= 9 ? `${s.slice(3, 6)}-${s.slice(6)}` : s;
}

export function gcUid(loai: GcLoai): string {
  const vn = new Date(Date.now() + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  const ngay = `${vn.getUTCFullYear()}${p(vn.getUTCMonth() + 1)}${p(vn.getUTCDate())}`;
  const gio = `${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}${p(vn.getUTCSeconds())}`;
  return `GC-${loai === 'dat' ? 'D' : 'N'}-${ngay}-${gio}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Kiểm dòng trước khi lưu — giống luật app chính (gc_nhap_lieu.nhan_phieu). Trả lỗi đầu tiên hoặc ''. */
export function kiemDong(loai: GcLoai, lines: GcLine[]): string {
  if (!lines.length) return 'Phiếu chưa có dòng nào';
  for (const [i, l] of lines.entries()) {
    if (!/^\d{9}/.test(l.saeji_no || '')) return `Dòng ${i + 1}: số chỉ thị không đúng`;
    if (!Number.isInteger(l.kg) || l.kg <= 0) return `Dòng ${i + 1}: kg phải là số NGUYÊN lớn hơn 0`;
    if (loai === 'nhap' && (!l.dat_no || !l.dat_seq)) return `Dòng ${i + 1}: chưa chọn thùng chờ về`;
  }
  return '';
}
