-- Migration 13: mở rộng type print_jobs cho tab Kế hoạch SX (user 13/7)
--
-- Thêm 'khsx_tong' / 'khsx_homnay' (in nguyên sheet KHSX qua agent + Excel COM)
-- và 'dccd' (in phiếu di chuyển công đoạn — agent ủy quyền app chính localhost).

ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_type_check;

ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_type_check
  CHECK (type IN ('registration', 'labels_day', 'overtime_summary',
                  'khsx_tong', 'khsx_homnay', 'dccd'));
