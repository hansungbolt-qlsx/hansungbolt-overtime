-- ============================================================
-- Migration 12: mở rộng type cho print_jobs
--
-- Thêm 'overtime_summary' vào CHECK constraint để cho phép in
-- báo cáo tổng hợp giờ tăng ca tháng qua agent.
--
-- ref_id format:
--   'YYYY-MM'        -> in tổng hợp tất cả bộ phận (admin)
--   'YYYY-MM|HD'     -> in tổng hợp chỉ HD (leader HD, hoặc admin
--                       xem tab HD)
--   'YYYY-MM|RL'     -> tương tự cho RL
--   'YYYY-MM|QLSX'   -> QLSX
-- ============================================================

ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_type_check;

ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_type_check
  CHECK (type IN ('registration', 'labels_day', 'overtime_summary'));
