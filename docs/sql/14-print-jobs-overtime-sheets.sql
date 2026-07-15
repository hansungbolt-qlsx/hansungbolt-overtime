-- Migration 14: thêm type 'overtime_sheets' cho print_jobs (user 15/7)
--
-- In GỘP mọi phiếu tăng ca của 1 ngày (HD + RL) trong 1 lệnh in — chỉ admin.
-- ref_id = 'YYYY-MM-DD'. Agent render từng phiếu qua trang view rồi in liên tiếp.

ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_type_check;

ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_type_check
  CHECK (type IN ('registration', 'labels_day', 'overtime_summary',
                  'khsx_tong', 'khsx_homnay', 'dccd', 'overtime_sheets'));
