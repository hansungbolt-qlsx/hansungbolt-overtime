// Trang in mở NGAY TRONG TAB HIỆN TẠI (anh Hữu chốt 07/11/2026 — không mở tab mới, app chạy dạng
// "ứng dụng" trên điện thoại không có thanh tab). Nút ✕ / Quay lại: về trang trước, không có thì về fallback.
export function quayLai(fallback = '/dashboard') {
  if (typeof window === 'undefined') return;
  if (window.history.length > 1) window.history.back();
  else window.location.href = fallback;
}
