// Hiển thị ngày/tháng NGẮN GỌN thống nhất toàn app (anh Hữu chốt 07/11/2026).
// Thuần, dùng được cả server lẫn client.

/** "2026-11-07" → "07/11/2026" · "2026-11" (month) → "11/2026" · rỗng → "Chọn ngày/tháng". */
export function dateLabel(value: string, mode: 'date' | 'month' = 'date'): string {
  const [y, m, d] = (value || '').split('-');
  if (mode === 'month') return y && m ? `${m}/${y}` : 'Chọn tháng';
  return y && m && d ? `${d}/${m}/${y.slice(0, 4)}` : 'Chọn ngày';
}
