-- Hansungbolt Overtime — Database schema
-- Chạy file này 1 lần trong Supabase SQL Editor để tạo 6 bảng + bật RLS

-- ============================================================
-- 1. users — tài khoản đăng nhập (admin + 2 leader)
-- ============================================================
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'leader')),
  department text CHECK (department IN ('HD', 'RL')),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. employees — danh sách nhân viên cố định (14 HD + 11 RL)
-- ============================================================
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  department text NOT NULL CHECK (department IN ('HD', 'RL')),
  order_no int NOT NULL,
  UNIQUE (department, order_no)
);

-- ============================================================
-- 3. equipments — danh sách máy cố định (HD ~42 máy, RL ~38 máy kể cả CT/SM)
-- ============================================================
CREATE TABLE equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  department text NOT NULL CHECK (department IN ('HD', 'RL')),
  spec text NOT NULL,
  machine_type text NOT NULL,
  rpm int NOT NULL
);

-- ============================================================
-- 4. daily_plans — kế hoạch sản xuất theo ngày (admin upload Excel)
-- ============================================================
CREATE TABLE daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_date date NOT NULL,
  equipment_code text NOT NULL,
  item_code text NOT NULL,
  item_name text,
  spec text,
  staff_name text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_plans_date_equipment ON daily_plans (plan_date, equipment_code);

-- ============================================================
-- 5. overtime_registrations — header phiếu tăng ca
-- ============================================================
CREATE TABLE overtime_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL CHECK (department IN ('HD', 'RL')),
  registered_by uuid NOT NULL REFERENCES users(id),
  overtime_date date NOT NULL,
  day_type text NOT NULL CHECK (day_type IN ('weekday', 'sunday')),
  time_from time NOT NULL,
  time_to time NOT NULL,
  duration_hours numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_overtime_registrations_date ON overtime_registrations (overtime_date);

-- ============================================================
-- 6. overtime_items — chi tiết từng dòng trong phiếu
-- ============================================================
CREATE TABLE overtime_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES overtime_registrations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  equipment_id uuid NOT NULL REFERENCES equipments(id),
  item_code text,
  item_name text,
  planned_quantity int,
  actual_quantity int,
  note text
);
CREATE INDEX idx_overtime_items_registration ON overtime_items (registration_id);

-- ============================================================
-- Bật RLS trên tất cả bảng
-- Service role (server-side của app) tự động bypass RLS.
-- Không viết policy nào → anon key không đọc/sửa được gì (an toàn).
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_items ENABLE ROW LEVEL SECURITY;
