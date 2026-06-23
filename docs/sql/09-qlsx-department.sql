-- ============================================================
-- Migration 09: Bộ phận QLSX
--
-- - Mở rộng CHECK constraint trên cột department ở 4 bảng để
--   chấp nhận 'QLSX' thêm (HD, RL, QLSX).
-- - Seed 5 NV QLSX vào bảng employees.
-- - Equipment CVK-QLSX sẽ tự tạo bởi backend khi có phiếu QLSX
--   đầu tiên (không seed ở đây).
--
-- Thuần additive: ALTER constraint + INSERT idempotent. Không
-- động dữ liệu cũ.
-- ============================================================

-- 1. users.department
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_department_check;
ALTER TABLE users ADD CONSTRAINT users_department_check
  CHECK (department IS NULL OR department IN ('HD', 'RL', 'QLSX'));

-- 2. employees.department
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_department_check;
ALTER TABLE employees ADD CONSTRAINT employees_department_check
  CHECK (department IN ('HD', 'RL', 'QLSX'));

-- 3. equipments.department
ALTER TABLE equipments DROP CONSTRAINT IF EXISTS equipments_department_check;
ALTER TABLE equipments ADD CONSTRAINT equipments_department_check
  CHECK (department IN ('HD', 'RL', 'QLSX'));

-- 4. overtime_registrations.department
ALTER TABLE overtime_registrations
  DROP CONSTRAINT IF EXISTS overtime_registrations_department_check;
ALTER TABLE overtime_registrations
  ADD CONSTRAINT overtime_registrations_department_check
  CHECK (department IN ('HD', 'RL', 'QLSX'));

-- 5. Seed 5 NV QLSX (idempotent qua unique (department, order_no))
INSERT INTO employees (full_name, department, order_no, active) VALUES
  ('HOÀNG CHÍNH HỮU',       'QLSX', 1, true),
  ('LÊ ĐỨC MINH',           'QLSX', 2, true),
  ('PHẠM VĂN CƯỜNG',        'QLSX', 3, true),
  ('NGUYỄN THỊ GIANG',      'QLSX', 4, true),
  ('NGUYỄN ÂU THU NGUYỆT',  'QLSX', 5, true)
ON CONFLICT (department, order_no) DO NOTHING;
