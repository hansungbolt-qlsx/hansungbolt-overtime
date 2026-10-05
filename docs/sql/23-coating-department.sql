-- ============================================================
-- Migration 23: Bộ phận COATING (mã `CO`) — anh Hữu chốt 05/10/2026
--
-- - Nới CHECK constraint cột department ở 4 bảng để nhận thêm 'CO'
--   (HD, RL, QLSX, CO). Y cách làm migration 09 (QLSX).
-- - Seed 3 máy Coating CO-01 · CO-02 · CO-03 (rpm 0: CO tính RPM theo mã hàng,
--   tổ trưởng NHẬP TAY RPM trên form đăng ký — anh Hữu 05/10).
-- - Seed 4 nhân viên Coating vào employees (tổ trưởng NGUYỄN ĐỨC HIẾU).
--   Tài khoản đăng nhập anh tự tạo ở /dashboard/users (username = tên không dấu,
--   mật khẩu hd123) — route POST /api/users sẽ reactivate/khớp employee cùng tên.
--
-- ⚠ Chạy trên Supabase SQL Editor TRƯỚC khi tạo tài khoản CO đầu tiên.
-- Thuần additive: ALTER constraint + INSERT idempotent. Không động dữ liệu cũ.
-- ============================================================

-- 1. users.department
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_department_check;
ALTER TABLE users ADD CONSTRAINT users_department_check
  CHECK (department IS NULL OR department IN ('HD', 'RL', 'QLSX', 'CO'));

-- 2. employees.department
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_department_check;
ALTER TABLE employees ADD CONSTRAINT employees_department_check
  CHECK (department IN ('HD', 'RL', 'QLSX', 'CO'));

-- 3. equipments.department
ALTER TABLE equipments DROP CONSTRAINT IF EXISTS equipments_department_check;
ALTER TABLE equipments ADD CONSTRAINT equipments_department_check
  CHECK (department IN ('HD', 'RL', 'QLSX', 'CO'));

-- 4. overtime_registrations.department
ALTER TABLE overtime_registrations
  DROP CONSTRAINT IF EXISTS overtime_registrations_department_check;
ALTER TABLE overtime_registrations
  ADD CONSTRAINT overtime_registrations_department_check
  CHECK (department IN ('HD', 'RL', 'QLSX', 'CO'));

-- 5. Seed 3 máy Coating (idempotent qua UNIQUE code)
INSERT INTO equipments (code, department, spec, machine_type, rpm) VALUES
  ('CO-01', 'CO', 'Coating', 'COATING', 0),
  ('CO-02', 'CO', 'Coating', 'COATING', 0),
  ('CO-03', 'CO', 'Coating', 'COATING', 0)
ON CONFLICT (code) DO NOTHING;

-- 6. Seed 4 nhân viên Coating (idempotent qua unique (department, order_no))
INSERT INTO employees (full_name, department, order_no, active) VALUES
  ('NGUYỄN ĐỨC HIẾU',  'CO', 1, true),
  ('NGUYỄN CHÍ HIẾU',  'CO', 2, true),
  ('NGUYỄN CHÍ TRUNG', 'CO', 3, true),
  ('ĐỖ ĐĂNG THẮNG',    'CO', 4, true)
ON CONFLICT (department, order_no) DO NOTHING;

-- Kiểm sau khi chạy:
--   SELECT code, department, rpm FROM equipments WHERE department = 'CO' ORDER BY code;
--   SELECT full_name, order_no FROM employees WHERE department = 'CO' ORDER BY order_no;
