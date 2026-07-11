-- ============================================================
-- Migration 11: print_jobs — hàng đợi in remote
--
-- Tổ trưởng dưới xưởng (4G) bấm 'Gửi in' -> app tạo row status=pending.
-- Agent Node.js trên máy admin poll pending, download PDF, gửi máy in,
-- update status printing -> done / error.
--
-- Thuần additive — tạo 1 bảng mới, không đụng dữ liệu cũ.
-- ============================================================

CREATE TABLE IF NOT EXISTS print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('registration', 'labels_day')),
  ref_id text NOT NULL, -- registration.id (uuid) hoặc plan_date (YYYY-MM-DD) cho tem
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'printing', 'done', 'error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- Index cho agent poll (chỉ scan job pending/printing, mới nhất trước)
CREATE INDEX IF NOT EXISTS idx_print_jobs_active
  ON print_jobs (created_at)
  WHERE status IN ('pending', 'printing');

-- Index cho leader xem status job của mình
CREATE INDEX IF NOT EXISTS idx_print_jobs_requester
  ON print_jobs (requested_by, created_at DESC);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
