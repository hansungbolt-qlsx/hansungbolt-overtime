-- ============================================================
-- Migration 08: Soft delete (đánh dấu Đã nghỉ)
--
-- Thay vì xóa cứng tài khoản, admin click "Đã nghỉ" để vô hiệu hóa.
-- Lợi ích:
--   - NV nghỉ rồi quay lại: click "Đang làm" để khôi phục, không phải
--     tạo lại từ đầu (giữ được order_no, giữ liên kết với phiếu cũ).
--   - Tránh phá vỡ FK overtime_items.employee_id.
--   - Vẫn ẩn NV khỏi dropdown + chặn login.
--
-- Thuần additive: ADD COLUMN IF NOT EXISTS. Không động dữ liệu cũ.
-- ============================================================

-- users: thêm active + deactivated_at
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- employees: thêm active + deactivated_at
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
