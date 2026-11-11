// KHO SƠN COATING trên app tăng ca (anh Hữu chốt 11/11/2026) — tab "🎨 Kho sơn", bộ phận CO.
// Tổ trưởng lập PHIẾU XUẤT (sơn: nguyên thùng; nylon: kg lẻ; hoá chất: lít lẻ) → bảng co_paint_slips
// (docs/sql/30-kho-son.sql) → agent → app chính ghi dòng 'XS-…' vào app Coating.
// Tồn Main theo lô + Tồn Line: file plan-files/kho-son.json (app chính tính, agent đẩy chỉ khi đổi).
// Nghiệp vụ gốc ở app chính: hsb-material-app/app/services/coating_kho.py — đổi ở đây phải kiểm cả hai đầu.

export const KS_BUCKET = 'plan-files';
export const KS_PATH = 'kho-son.json';
export const KS_SUA_NGAY = 7;                  // tổ trưởng sửa/huỷ phiếu của mình trong 7 ngày

export type KsLo = { lot_id: string; lot_no: string; han: string | null; ngay_nhap?: string | null; con_ngay: number | null; ton: number;
  ton_kg: number; muc: 'tot' | 'sap' | 'het' };
export type KsSanPham = { product_id: string; code: string; ten: string; ten_day_du: string; don_vi: string;
  kg_moi_dv: number; la_thung: boolean; mau?: string | null; ton: number; ton_kg: number; lo: KsLo[]; co_line: boolean; line_kg: number | null };
export type KsTon = { ok: boolean; loi?: string; at?: string; rev?: number; doc_luc?: string;
  phieu_v?: Record<string, number>; san_pham: KsSanPham[]; chua_dinh_muc?: { ma: string; ea: number }[] };

export type KsDong = { line_id: string; product_id: string; lot_id: string; qty: number;
  doi_lo_ly_do?: string | null; het_han?: string | null };
export type KsLichSu = { v: number; by: string; at: string; action: 'sua' | 'huy'; reason: string; before: KsDong[] };
export type KsPhieu = { so_phieu: string; ngay: string; status: 'pending' | 'synced' | 'cancelled'; version: number;
  lines: KsDong[]; history: KsLichSu[]; cancel_reason: string | null; created_by: string | null;
  created_by_name: string | null; sent_at: string; synced_at: string | null; main_version: number | null;
  last_error: string | null };

export function canUseKhoSon(s: { department?: string | null; role?: string } | null | undefined): boolean {
  return !!s && (s.department === 'CO' || s.role === 'admin');
}
/** Xuất kho: tổ trưởng Coating (+ admin). Nhân viên CO chỉ xem tồn. */
export function canXuatKhoSon(s: { department?: string | null; role?: string } | null | undefined): boolean {
  return !!s && ((s.department === 'CO' && s.role === 'leader') || s.role === 'admin');
}
/** Sửa / xoá phiếu đã xuất: TỔ TRƯỞNG Coating (+ admin), trong 7 ngày kể từ lúc Gửi (anh Hữu 11/11/2026 — trước là
 *  chỉ người lập). Tổ viên CO không thấy chức năng này. Quá hạn → admin app Coating điều chỉnh bên app Coating. */
export function duocSua(p: Pick<KsPhieu, 'sent_at' | 'status'>, s: { department?: string | null; role?: string } | null | undefined,
  now = Date.now()): boolean {
  return p.status !== 'cancelled' && canXuatKhoSon(s) && now - new Date(p.sent_at).getTime() <= KS_SUA_NGAY * 86400_000;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Dòng của phiếu ở version k (từ lịch sử: mục v = k+1 giữ 'before' = dòng version k). */
function dongTaiVersion(p: KsPhieu, k: number): KsDong[] {
  if (k <= 0) return [];
  if (k >= p.version) return p.status === 'cancelled' ? [] : p.lines;
  const h = (p.history || []).find((x) => x.v === k + 1);
  if (!h) return [];
  // bản k là bản đã bị huỷ ở bước k+1? 'before' vẫn là dòng còn hiệu lực ở k
  return h.before || [];
}

/** Tồn theo lô = file app chính − phần phiếu app chính CHƯA tính (phiếu mới / bản sửa chưa tới app chính). */
export function tonTam(ton: KsTon | null, phieus: KsPhieu[], boQua?: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const sp of ton?.san_pham || []) for (const l of sp.lo) m[l.lot_id] = l.ton;
  const pv = ton?.phieu_v || {};
  for (const p of phieus) {
    const daTinh = pv[p.so_phieu] || 0;
    if (p.so_phieu === boQua) {                      // đang sửa phiếu này: trả lại phần app chính đã trừ của nó
      for (const d of dongTaiVersion(p, daTinh)) m[d.lot_id] = r3((m[d.lot_id] || 0) + d.qty);
      continue;
    }
    if (p.version <= daTinh) continue;
    for (const d of dongTaiVersion(p, daTinh)) m[d.lot_id] = r3((m[d.lot_id] || 0) + d.qty);     // trả lại bản app chính đã trừ
    for (const d of p.status === 'cancelled' ? [] : p.lines) m[d.lot_id] = r3((m[d.lot_id] || 0) - d.qty);
  }
  return m;
}

/** Thứ tự xuất: theo file app chính (HSD sớm trước, cùng HSD nhập trước). Lô tồn ≤ 0 bỏ qua. */
export function chiaFifo(sp: KsSanPham, tong: number, tonLo: Record<string, number>): { lot_id: string; qty: number }[] | null {
  let con = r3(tong);
  const out: { lot_id: string; qty: number }[] = [];
  for (const l of sp.lo) {
    if (con <= 0) break;
    const co = tonLo[l.lot_id] ?? 0;
    if (co <= 0) continue;
    const lay = sp.la_thung ? Math.min(Math.floor(co), con) : Math.min(co, con);
    if (lay <= 0) continue;
    out.push({ lot_id: l.lot_id, qty: r3(lay) });
    con = r3(con - lay);
  }
  return con > 0 ? null : out;
}

export function soPhieuNgay(ngay: string): string {
  return `XS-${ngay.slice(2, 4)}${ngay.slice(5, 7)}${ngay.slice(8, 10)}-`;
}

export function hanVN(han: string | null): string {
  return han ? `${han.slice(8, 10)}/${han.slice(5, 7)}/${han.slice(0, 4)}` : '';
}

/** Kiểm dòng trước khi gửi (server + client dùng chung). Trả lỗi đầu tiên hoặc null. */
export function kiemDongKs(lines: KsDong[], ton: KsTon | null, tonLo: Record<string, number>): string | null {
  if (!lines.length) return 'Phiếu chưa có dòng xuất';
  const sp = new Map((ton?.san_pham || []).map((p) => [p.product_id, p]));
  const can: Record<string, number> = {};
  for (const d of lines) {
    const p = sp.get(d.product_id);
    if (!p) return `Vật tư ${d.product_id} không còn trên app Coating`;
    if (!p.lo.some((l) => l.lot_id === d.lot_id)) return `${p.code}: lô không còn tồn`;
    if (!(d.qty > 0)) return `${p.code}: số lượng phải lớn hơn 0`;
    if (p.la_thung && !Number.isInteger(d.qty)) return `${p.code}: sơn xuất nguyên thùng (số nguyên)`;
    can[d.lot_id] = r3((can[d.lot_id] || 0) + d.qty);
  }
  for (const [lot, q] of Object.entries(can)) {
    if (q > (tonLo[lot] ?? 0) + 1e-9) {
      const p = (ton?.san_pham || []).find((x) => x.lo.some((l) => l.lot_id === lot));
      const l = p?.lo.find((x) => x.lot_id === lot);
      return `${p?.code ?? ''} lô ${l?.lot_no || '—'}: xuất ${q} vượt tồn ${tonLo[lot] ?? 0}`;
    }
  }
  return null;
}
