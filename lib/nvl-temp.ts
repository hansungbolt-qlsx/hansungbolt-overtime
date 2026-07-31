// ===========================================================================
// PHIẾU XUẤT KHO TẠM — HÀNG CHƯA NHẬP KHO (user chốt 31/07/2026)
//
// NPL về gấp, vào thẳng sản xuất trước khi app chính kịp nhập kho. Nhân viên kho
// ghi tạm: mã + LOT gõ tay từ tem cuộn + KG gõ tay. Khi app chính nhập kho và
// đẩy tồn xuống, màn hình đối chiếu chỉ ra cuộn khớp / lệch rồi gợi ý cuộn đúng
// để chốt; chốt xong dòng đi vào PHIẾU XUẤT KHO HÔM NAY như dòng bình thường.
//
// File TÁCH RIÊNG khỏi nvl-slips.ts: luồng xuất kho thật đang chạy ổn định,
// không trộn khái niệm mới vào đó.
// ===========================================================================

import type { Branch, Department, StockCoil } from './nvl-slips';

/** 1 dòng xuất tạm (bảng nvl_temp_lines — migration 22). */
export type TempLine = {
  id: string;
  branch: Branch;
  /** Ngày hàng thực sự được đưa vào sản xuất — có thể KHÁC ngày chốt. */
  real_date: string;
  department: Department;
  material_code: string;
  material_name?: string | null;
  material_spec?: string | null;
  /** Lot/số hiệu cuộn gõ tay từ tem. Phụ liệu luôn rỗng. */
  lot_typed?: string | null;
  qty: number;
  unit: string;
  note?: string | null;
  status: 'waiting' | 'merged';
  merged_at?: string | null;
  merged_coil_no?: string | null;
  merged_lot_no?: string | null;
  created_by_name?: string | null;
  created_at: string;
};

/** Kết quả đối chiếu 1 dòng tạm với tồn kho app chính. */
export type TempMatch = {
  line: TempLine;
  /** Cuộn app gợi ý. null = không quyết được, người dùng tự chọn. */
  pick: StockCoil | null;
  /** exact = khớp cả lot lẫn Kg · kg_only = Kg đúng nhưng lot lệch ·
   *  none = không cuộn nào đúng Kg */
  verdict: 'exact' | 'kg_only' | 'none';
  /** Câu giải thích hiện lên màn hình cho người dùng. */
  reason: string;
  /** Cuộn cùng mã để tự chọn khi máy không quyết được. */
  candidates: StockCoil[];
};

/**
 * So lot gõ tay với lot/số hiệu cuộn: bỏ khoảng trắng, không phân biệt hoa thường.
 *
 * CẤM nới thêm (bỏ dấu gạch, cắt hậu tố, so gần đúng...) — bài học KOS/Vĩnh
 * Thành 15/7: nới một lần là ghép sai âm thầm mãi mãi. Không khớp tuyệt đối thì
 * để người chọn tay, KHÔNG đoán.
 *
 * So với CẢ coil_no vì hàng Vĩnh Thành nhập kho không có lot — trên điện thoại
 * cuộn đó hiển thị bằng số hiệu cuộn, nên nhân viên kho sẽ gõ số hiệu.
 */
export function lotEq(typed?: string | null, coilLot?: string | null): boolean {
  const norm = (s?: string | null) => (s || '').replace(/\s+/g, '').toUpperCase();
  const a = norm(typed);
  return a !== '' && a === norm(coilLot);
}

/**
 * Kg khớp TUYỆT ĐỐI (user chốt 31/7: "phải đúng 100%, không có ngoại lệ").
 *
 * Ngưỡng 0,0005 KHÔNG phải dung sai nghiệp vụ mà chỉ để né sai số dấu phẩy động
 * của máy tính: tồn app chính lưu 3 số lẻ, hai số bằng nhau luôn lệch nhỏ hơn.
 */
export function kgEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0005;
}

function fmtKgShort(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}

/**
 * Đối chiếu 1 dòng tạm với danh sách cuộn đang ở kho Main.
 *
 * Thứ tự ưu tiên (user chốt 31/7):
 *   1. Lọc cuộn cùng mã, còn ở kho, CHƯA bị dòng tạm khác ăn mất.
 *   2. Lọc tiếp theo Kg khớp TUYỆT ĐỐI.
 *   3. Trong nhóm Kg đúng: lot khớp → chọn. Nhiều cuộn giống hệt (NCC hay ghi
 *      1 lot cho cả lô) → lấy cuộn NHẬP TRƯỚC NHẤT.
 *   4. Kg đúng nhưng không cuộn nào khớp lot → gợi ý cuộn Kg đúng, LOT CŨ NHẤT.
 *   5. Không cuộn nào Kg đúng → KHÔNG đoán bừa, trả cả danh sách để người tự chọn.
 *
 * `usedCoilIds` = cuộn đã bị dòng tạm trước đó ăn → một cuộn không bao giờ được
 * ghép cho hai dòng (user chốt 31/7).
 */
export function matchTempLine(
  line: TempLine, coils: StockCoil[], usedCoilIds: Set<number>,
): TempMatch {
  const pool = coils.filter((c) => c.code === line.material_code && !usedCoilIds.has(c.id));
  // Cuộn nhập trước nhất lên đầu — "lot cũ nhất" theo đúng tinh thần FIFO.
  const byOld = (a: StockCoil, b: StockCoil) =>
    String(a.received_at || '').localeCompare(String(b.received_at || '')) || a.id - b.id;

  const kgOk = pool.filter((c) => kgEq(c.kg, line.qty)).sort(byOld);

  // Ô CHỌN TAY LUÔN CÓ ĐỦ MỌI CUỘN của mã đó (user chốt 31/7 chiều), chỉ xếp
  // cuộn trùng Kg lên đầu. Trước đây khi đã tìm được cuộn trùng Kg thì danh sách
  // bị thu hẹp còn mấy cuộn đó → nhân viên kho GÕ NHẦM Kg (hay gặp với hàng nhập
  // tay kiểu Vĩnh Thành, trọng lượng ghi tay dễ lệch) thì không cách nào chọn
  // đúng cuộn mình đã lấy, phải xoá dòng gõ lại từ đầu.
  const kgIds = new Set(kgOk.map((c) => c.id));
  const allSorted = [...kgOk, ...pool.filter((c) => !kgIds.has(c.id)).sort(byOld)];

  if (kgOk.length > 0) {
    const lotOk = kgOk.filter(
      (c) => lotEq(line.lot_typed, c.lot_no) || lotEq(line.lot_typed, c.coil_no),
    );
    if (lotOk.length > 0) {
      return {
        line, pick: lotOk[0], verdict: 'exact', candidates: allSorted,
        reason: lotOk.length > 1
          ? `Khớp lot và Kg — có ${lotOk.length} cuộn giống hệt, lấy cuộn nhập trước nhất`
          : 'Khớp cả lot lẫn Kg',
      };
    }
    // Chưa gõ lot ≠ gõ sai lot — nói đúng bản chất để người dùng khỏi tưởng mình
    // gõ nhầm (hàng Vĩnh Thành nhập tay thường không có lot NCC để mà gõ).
    const daGoLot = (line.lot_typed || '').trim() !== '';
    const cuonGoiY = kgOk[0].lot_no ? `lot ${kgOk[0].lot_no}` : `cuộn ${kgOk[0].coil_no}`;
    return {
      line, pick: kgOk[0], verdict: 'kg_only', candidates: allSorted,
      reason: daGoLot
        ? `Lot không khớp — nhưng có cuộn đúng ${fmtKgShort(line.qty)} Kg, ${cuonGoiY}`
        : `Chưa gõ lot — gợi ý theo Kg: cuộn đúng ${fmtKgShort(line.qty)} Kg, ${cuonGoiY}`,
    };
  }
  return {
    line, pick: null, verdict: 'none', candidates: allSorted,
    reason: pool.length === 0
      ? 'Chưa có cuộn nào của mã này trong kho'
      : `Kg đã gõ (${fmtKgShort(line.qty)}) không trùng cuộn nào — chọn tay`,
  };
}

/**
 * Đối chiếu CẢ DANH SÁCH dòng tạm một lượt.
 * Đi tuần tự và cộng dồn cuộn đã dùng → không dòng nào ăn trùng cuộn của dòng khác.
 */
export function matchAllTempLines(lines: TempLine[], coils: StockCoil[]): TempMatch[] {
  const used = new Set<number>();
  const out: TempMatch[] = [];
  for (const ln of lines) {
    const m = matchTempLine(ln, coils, used);
    if (m.pick) used.add(m.pick.id);
    out.push(m);
  }
  return out;
}

/** Dòng tạm treo quá ngưỡng này (giờ) thì bôi đỏ — user chốt 31/7: 24h. */
export const TEMP_STALE_HOURS = 24;

export function isStale(line: TempLine, now = Date.now()): boolean {
  return line.status === 'waiting'
    && now - new Date(line.created_at).getTime() > TEMP_STALE_HOURS * 3600_000;
}
