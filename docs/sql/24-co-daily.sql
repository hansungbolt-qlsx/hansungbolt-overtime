-- ============================================================
-- Migration 24: SẢN LƯỢNG COATING HÀNG NGÀY (bộ phận CO) — anh Hữu chốt 05/10/2026
--
-- Nhân viên CO quét tem LOT xi mạ (mã vạch 10 số YYMMDDNNNN, in ở app chính /giacong/labels)
-- → app hiện chỉ thị · mã hàng · kg của LOT (catalog agent kéo từ app chính) → nhập máy, kg (sửa được),
-- nhân viên, ghi chú → cuối ngày bấm Gửi → agent đẩy sang APP CHÍNH (lưu VĨNH VIỄN, TV › Kết quả Coating).
-- Supabase chỉ là hộp thư: cron xoá phiếu ĐÃ VỀ app chính quá 30 ngày.
--
-- Thuần additive: 2 bảng mới + nới CHECK print_jobs.type thêm 'co_day'. Không đụng dữ liệu cũ.
-- ⚠ Chạy trên Supabase SQL Editor TRƯỚC khi deploy code.
-- ============================================================

-- 1. Phiếu ngày (mỗi ngày đúng 1 phiếu)
CREATE TABLE IF NOT EXISTS co_day_slips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         text NOT NULL UNIQUE,                 -- 'CO-YYYYMMDD' — khoá gửi sang app chính
  work_date   date NOT NULL UNIQUE,
  -- draft    = 📝 đang ghi (sửa thoải mái)
  -- pending  = 📤 đã bấm Gửi, chờ agent đẩy
  -- received = ✅ app chính đã nhận (sửa lại → tự về draft, phải Gửi lại)
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'received')),
  note        text,
  created_by_name text,
  sent_at     timestamptz,
  sent_by_name text,
  synced_at   timestamptz,                          -- lần agent đẩy sau cùng (NULL = chưa đẩy bản hiện tại)
  received_at timestamptz,
  main_ref    text,                                 -- id phiếu bên app chính
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_co_day_slips_status ON co_day_slips (status);

-- 2. Dòng (1 dòng = 1 LOT xi mạ đã coating)
CREATE TABLE IF NOT EXISTS co_day_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id       uuid NOT NULL REFERENCES co_day_slips(id) ON DELETE CASCADE,
  seq_no        int  NOT NULL DEFAULT 1,
  machine       text NOT NULL,                      -- CO-01 / CO-02 / CO-03
  lot_no        text NOT NULL,                      -- '2610050048' (= mã vạch tem)
  lot_label     text,                               -- '261005-0048-NPT'
  vendor        text,
  saeji         text,                               -- Số chỉ thị (SaejiNo)
  item_code     text,
  item_name     text,
  lot_weight_kg numeric,                            -- kg của LOT trên ERP (mặc định)
  weight_kg     numeric NOT NULL CHECK (weight_kg > 0),
  lot_qty       numeric,
  employee_id   uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_name text,
  note          text,
  matched       boolean NOT NULL DEFAULT true,      -- false = gõ tay, LOT không có trong catalog ERP
  created_by_name text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_co_day_lines_slip ON co_day_lines (slip_id);

ALTER TABLE co_day_slips ENABLE ROW LEVEL SECURITY;   -- như các bảng khác: chỉ service key (server) đọc/ghi
ALTER TABLE co_day_lines ENABLE ROW LEVEL SECURITY;

-- 3. Lệnh in bảng Kết quả Coating ngày qua máy in xưởng
ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_type_check;
ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_type_check
  CHECK (type IN ('registration', 'labels_day', 'overtime_summary',
                  'khsx_tong', 'khsx_homnay', 'dccd', 'overtime_sheets', 'co_day'));

-- Kiểm sau khi chạy:
--   SELECT table_name FROM information_schema.tables WHERE table_name IN ('co_day_slips','co_day_lines');
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'print_jobs_type_check';
