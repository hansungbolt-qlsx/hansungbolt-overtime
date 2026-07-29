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
// =============================================================================

export type DayType = 'weekday' | 'sunday';

export type RegRow = {
  id: string;
  overtime_date: string;          // 'YYYY-MM-DD'
  day_type: string;               // 'weekday' | 'sunday'
  duration_hours: number | null;  // giờ leader khai cho cả phiếu
};

export type ItemRow = {
  employee_id: string;
  registration_id: string;
  duration_hours: number | null;  // giờ admin sửa tay per-dòng (migration 06)
};

/** Gom giờ về (người × ngày) + map ngày → loại ngày.
 *  Ưu tiên: giờ item admin đã sửa tay → giờ registration leader khai →
 *  8h chủ nhật / 3h ngày thường. Trùng ngày lấy MAX. */
export function buildEmpDateHours(regs: RegRow[], items: ItemRow[]) {
  const dateTypeMap = new Map<string, DayType>();
  const regMap = new Map<
    string,
    { date: string; dayType: DayType; durationHours: number }
  >();
  for (const r of regs) {
    dateTypeMap.set(r.overtime_date, r.day_type as DayType);
    regMap.set(r.id, {
      date: r.overtime_date,
      dayType: r.day_type as DayType,
      durationHours: Number(r.duration_hours ?? 0),
    });
  }

  const empDateMap = new Map<string, Map<string, number>>();
  for (const it of items) {
    const reg = regMap.get(it.registration_id);
    if (!reg) continue;
    if (!empDateMap.has(it.employee_id)) empDateMap.set(it.employee_id, new Map());
    const dateMap = empDateMap.get(it.employee_id)!;
    const hours = Number(
      it.duration_hours ??
        reg.durationHours ??
        (reg.dayType === 'sunday' ? 8 : 3),
    );
    const existing = dateMap.get(reg.date) ?? 0;
    if (hours > existing) dateMap.set(reg.date, hours);
  }

  return { empDateMap, dateTypeMap };
}
