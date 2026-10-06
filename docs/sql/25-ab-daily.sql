-- ============================================================
-- Migration 25: SẢN LƯỢNG A/B (công đoạn 84) cho bộ phận CO — anh Hữu chốt 06/10/2026
--
-- Dùng CHUNG 2 bảng của Sản lượng CO (migration 24), thêm cột `stage`:
--   '86' = Coating (CO, phiếu cũ tự là 86)   ·   '84' = A/B (máy AB-01)
-- Khoá "mỗi ngày 1 phiếu" đổi thành "mỗi ngày × mỗi công đoạn 1 phiếu".
-- uid giữ nguyên dạng: CO-YYYYMMDD (86) · AB-YYYYMMDD (84).
--
-- Không xoá / không sửa dòng nào. Chạy lại nhiều lần vẫn an toàn.
-- ⚠ Chạy trên Supabase SQL Editor TRƯỚC khi deploy code.
-- ============================================================

-- 1. Cột công đoạn (phiếu đang có → '86')
ALTER TABLE co_day_slips ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT '86';
ALTER TABLE co_day_slips DROP CONSTRAINT IF EXISTS co_day_slips_stage_check;
ALTER TABLE co_day_slips ADD CONSTRAINT co_day_slips_stage_check CHECK (stage IN ('86', '84'));

-- 2. Bỏ khoá UNIQUE chỉ trên work_date (tên mặc định co_day_slips_work_date_key — tìm theo cột cho chắc)
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'co_day_slips'::regclass AND contype = 'u'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                        WHERE attrelid = 'co_day_slips'::regclass AND attname = 'work_date')]::smallint[];
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE co_day_slips DROP CONSTRAINT %I', c);
  END IF;
END $$;

-- 3. Khoá mới: mỗi ngày × mỗi công đoạn đúng 1 phiếu
ALTER TABLE co_day_slips DROP CONSTRAINT IF EXISTS co_day_slips_work_date_stage_key;
ALTER TABLE co_day_slips ADD CONSTRAINT co_day_slips_work_date_stage_key UNIQUE (work_date, stage);

-- Kiểm sau khi chạy (phải thấy: CHECK stage, UNIQUE (work_date, stage), UNIQUE (uid), KHÔNG còn UNIQUE (work_date) riêng):
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'co_day_slips'::regclass ORDER BY conname;
--   SELECT stage, count(*) FROM co_day_slips GROUP BY stage;
