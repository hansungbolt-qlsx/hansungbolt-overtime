-- ============================================================
-- Migration 15: machine_stop_reasons — tổ trưởng ghi lý do dừng máy
--
-- Tổ trưởng cuối ngày ghi lý do cho các máy CẢ NGÀY không sản xuất
-- (1 lý do / máy / ngày). App chính poll về điền TV Kết quả ngày;
-- người tổng hợp TV vẫn là người chốt cuối (sửa đè được).
--
-- Thuần additive — tạo 1 bảng mới, không đụng dữ liệu cũ.
-- ============================================================

CREATE TABLE IF NOT EXISTS machine_stop_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_date date NOT NULL,
  machine_code text NOT NULL,          -- 'HD-01' — trùng code tv_machine app chính
  department text NOT NULL DEFAULT 'HD',
  reason_code text NOT NULL
    CHECK (reason_code IN ('NW', 'NM', 'NP', 'NR', 'MT', 'ETC')),
  reason_text text,                    -- bắt buộc khi ETC (app kiểm tra)
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_name text,                -- snapshot tên tổ trưởng
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stop_date, machine_code)
);

-- Poll của app chính: lọc theo ngày
CREATE INDEX IF NOT EXISTS idx_stop_reasons_date
  ON machine_stop_reasons (stop_date);
