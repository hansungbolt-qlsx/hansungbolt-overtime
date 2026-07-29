-- ============================================================
-- 18. LÝ DO TRẢ KHO theo TỪNG DÒNG (user chốt 29/07/2026)
--
-- Trước đây mọi phiếu trả kho gửi từ app tăng ca đều bị app chính đóng cứng
-- lý do "SX DƯ-TRẢ KHO". User chốt 3 lựa chọn:
--     1) Sản xuất dư - trả kho     (mặc định)
--     2) NVL lỗi - Trả kho
--     3) Khác — nhập lý do cụ thể, lưu thẳng nội dung người dùng gõ
--
-- Gắn theo TỪNG DÒNG chứ không phải cả phiếu: một ngày có thể vừa trả hàng
-- sản xuất dư vừa trả cuộn lỗi. Lúc duyệt, app chính TÁCH thành nhiều phiếu
-- thật theo (bộ phận × lý do) — vì bên đó lý do lưu ở cấp phiếu.
--
-- Cột để NULL với phiếu xuất kho (xuất kho không có khái niệm lý do) và với
-- các phiếu trả cũ tạo trước 29/07 — app chính hiểu NULL = lý do mặc định.
--
-- Chạy 1 lần trên Supabase → SQL Editor. An toàn, không đụng dữ liệu cũ.
-- ============================================================

ALTER TABLE nvl_slip_lines
  ADD COLUMN IF NOT EXISTS reason text;

COMMENT ON COLUMN nvl_slip_lines.reason IS
  'Lý do TRẢ kho của riêng dòng này. NULL = mặc định "Sản xuất dư - trả kho". Phiếu xuất kho luôn NULL.';
