-- ============================================================
-- Migration 16: machine_stop_reasons — thêm lý do ST + cờ dismissed
--
-- (user 20/7)
-- 1. Thêm 'ST' (Setting) vào danh mục lý do dừng khách quan.
-- 2. Cột dismissed: tổ trưởng bấm "Máy có chạy — bỏ" = ẩn mềm (soft delete)
--    → bản ghi prefill tự động từ KHSX không bị tái sinh sau khi bỏ.
-- ============================================================

ALTER TABLE machine_stop_reasons
  DROP CONSTRAINT IF EXISTS machine_stop_reasons_reason_code_check;

ALTER TABLE machine_stop_reasons
  ADD CONSTRAINT machine_stop_reasons_reason_code_check
  CHECK (reason_code IN ('NW', 'NM', 'NP', 'NR', 'MT', 'ST', 'ETC'));

ALTER TABLE machine_stop_reasons
  ADD COLUMN IF NOT EXISTS dismissed boolean NOT NULL DEFAULT false;
