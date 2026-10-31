// =============================================================================
// LUẬT QUY GIỜ TĂNG CA VỀ TỪNG NGƯỜI × NGÀY — NƠI DUY NHẤT của luật này.
//
// Trích nguyên văn từ trang in /print/overtime-summary (bản admin đang in hàng
// tháng). Hai nơi cùng gọi hàm này:
//   1) trang in tổng hợp tháng (app/print/overtime-summary/page.tsx)
//   2) API đồng bộ sang app chính (app/api/overtime-export/route.ts)
// App chính KHÔNG tính lại giờ — chỉ nhận số đã tính từ đây.
//
// ⚠ BẪY ĐÃ ĐO THẬT (29/7/2026): cộng theo từng DÒNG phiếu là phồng 4,4 lần
// (2.169h thay vì 493,5h đúng của tháng 7). Một người đứng nhiều máy/nhiều mã
// trong cùng ngày → giờ lấy MAX, KHÔNG cộng dồn.
//
// CA AM/PM (anh Hữu 21/10/2026): MAX lấy TRONG TỪNG CA, rồi CỘNG các ca của
// ngày đó. Người làm sáng 1,5h + chiều 3h = 4,5h (lấy MAX cả ngày là mất 1,5h).
// Phiếu cũ không có ca → PM, nên ngày chỉ 1 ca ra đúng số như trước.
// Trang Tổng hợp giờ (/api/registrations/summary) cũng gọi hàm này.
//
// LOẠI NGÀY THEO TỪNG PHIẾU (anh Hữu 31/10/2026): giờ của một người là giờ Chủ nhật
// hay ngày thường lấy theo PHIẾU người đó có tên (empDateType), KHÔNG theo cả ngày.
// Trước đây dateTypeMap lấy loại ngày của phiếu đọc sau cùng trong ngày → 01/10 CO
// đăng ký Chủ nhật làm giờ HD/RL ngày thường bị tính vào cột Chủ nhật. dateTypeMap
// nay chỉ dùng tô màu cột: 'sunday' khi trong ngày có ít nhất một phiếu Chủ nhật.
// Số giờ không đổi — vẫn tính theo phiếu hiện tại trên app (bản sửa cuối cùng).
// =============================================================================

import { normShift } from '@/lib/overtime-shift';

export type DayType = 'weekday' | 'sunday';

export type RegRow = {
  id: string;
  overtime_date: string;          // 'YYYY-MM-DD'
  day_type: string;               // 'weekday' | 'sunday'
  duration_hours: number | null;  // giờ leader khai cho cả phiếu
  shift?: string | null;          // 'AM' | 'PM' (migration 28) — thiếu = PM
};

export type ItemRow = {
  employee_id: string;
  registration_id: string;
  duration_hours: number | null;  // giờ admin sửa tay per-dòng (migration 06)
};

/** Gom giờ về (người × ngày) + map ngày → loại ngày.
 *  Ưu tiên: giờ item admin đã sửa tay → giờ registration leader khai →
 *  8h chủ nhật / 3h ngày thường. Trong một ca lấy MAX, các ca cộng lại. */
export function buildEmpDateHours(regs: RegRow[], items: ItemRow[]) {
  const dateTypeMap = new Map<string, DayType>();
  // Loại ngày của từng ô người × ngày — theo phiếu người đó có tên (31/10/2026)
  const empDateType = new Map<string, Map<string, DayType>>();
  const regMap = new Map<
    string,
    { date: string; dayType: DayType; durationHours: number; shift: string }
  >();
  for (const r of regs) {
    // Cột ngày: Chủ nhật nếu có ít nhất một phiếu Chủ nhật (không phụ thuộc thứ tự đọc)
    if (dateTypeMap.get(r.overtime_date) !== 'sunday') {
      dateTypeMap.set(r.overtime_date, r.day_type === 'sunday' ? 'sunday' : 'weekday');
    }
    regMap.set(r.id, {
      date: r.overtime_date,
      dayType: r.day_type as DayType,
      durationHours: Number(r.duration_hours ?? 0),
      shift: normShift(r.day_type, r.shift),
    });
  }

  // Bước 1: MAX theo (người × ngày × ca) — nhớ luôn loại ngày của phiếu cho số MAX đó
  const empDateShift = new Map<string, Map<string, Map<string, number>>>();
  const empDateShiftType = new Map<string, DayType>();   // khoá `${emp}|${date}|${ca}`
  for (const it of items) {
    const reg = regMap.get(it.registration_id);
    if (!reg) continue;
    if (!empDateShift.has(it.employee_id)) empDateShift.set(it.employee_id, new Map());
    const dateMap = empDateShift.get(it.employee_id)!;
    if (!dateMap.has(reg.date)) dateMap.set(reg.date, new Map());
    const shiftMap = dateMap.get(reg.date)!;
    const hours = Number(
      it.duration_hours ??
        reg.durationHours ??
        (reg.dayType === 'sunday' ? 8 : 3),
    );
    const existing = shiftMap.get(reg.shift) ?? 0;
    const key = `${it.employee_id}|${reg.date}|${reg.shift}`;
    if (hours > existing) {
      shiftMap.set(reg.shift, hours);
      empDateShiftType.set(key, reg.dayType === 'sunday' ? 'sunday' : 'weekday');
    } else if (!empDateShiftType.has(key)) {
      empDateShiftType.set(key, reg.dayType === 'sunday' ? 'sunday' : 'weekday');
    }
  }

  // Bước 2: cộng các ca của cùng ngày
  const empDateMap = new Map<string, Map<string, number>>();
  for (const [empId, dateMap] of empDateShift) {
    const out = new Map<string, number>();
    const types = new Map<string, DayType>();
    for (const [date, shiftMap] of dateMap) {
      if (shiftMap.size === 0) continue; // y bản cũ: dòng 0 giờ không tạo ô
      let sum = 0;
      // Một người một ngày gần như chỉ một loại phiếu (Chủ nhật 06–14h chồng giờ ca sáng nên
      // không đăng ký chung được). Nếu lẫn cả hai → lấy loại có nhiều giờ hơn, bằng nhau → Chủ nhật.
      let hSun = 0;
      let hWd = 0;
      let coSun = false;
      for (const [shift, h] of shiftMap) {
        sum += h;
        if (empDateShiftType.get(`${empId}|${date}|${shift}`) === 'sunday') { hSun += h; coSun = true; }
        else hWd += h;
      }
      out.set(date, sum);
      types.set(date, coSun && hSun >= hWd ? 'sunday' : 'weekday');
    }
    empDateMap.set(empId, out);
    empDateType.set(empId, types);
  }

  return { empDateMap, dateTypeMap, empDateType };
}
