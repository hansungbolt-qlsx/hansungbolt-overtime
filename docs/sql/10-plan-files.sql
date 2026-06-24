-- ============================================================
-- Migration 10: plan_files — lưu metadata file Excel kế hoạch đã upload
--
-- File gốc lưu trong Supabase Storage bucket 'plan-files'.
-- Bảng plan_files chỉ lưu metadata + path để truy xuất.
-- Chỉ giữ 3 file gần nhất; cleanup ở app code khi upload mới.
-- Thuần additive — không động dữ liệu daily_plans.
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_date date NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  sheet_name text,
  file_size_bytes int,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_files_date ON plan_files (plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_plan_files_uploaded ON plan_files (uploaded_at DESC);

ALTER TABLE plan_files ENABLE ROW LEVEL SECURITY;
