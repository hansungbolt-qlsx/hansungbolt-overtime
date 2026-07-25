-- ============================================================
-- Migration 10: Vai trò 'qlsx' (user chốt 24/7/2026)
--
-- Tài khoản nhân viên QLSX: xem KHSX + in phiếu (KHSX / DCCD đủ
-- 4 công đoạn), xem Máy dừng + Tổng hợp tăng ca (mọi bộ phận).
-- KHÔNG in tem, KHÔNG đăng ký tăng ca, KHÔNG vào danh sách
-- nhân viên tăng ca (users.role='qlsx' không insert employees).
--
-- Thuần additive: chỉ nới CHECK constraint cột users.role
-- (04-multi-user.sql giới hạn admin/leader/worker). Không động
-- dữ liệu cũ.
-- ============================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'leader', 'worker', 'qlsx'));
