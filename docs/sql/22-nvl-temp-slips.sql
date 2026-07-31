-- ============================================================
-- Migration 22: PHIẾU XUẤT KHO TẠM — HÀNG CHƯA NHẬP KHO (31/07/2026)
--
-- Bối cảnh (user chốt 31/7): NPL về gấp, đưa thẳng vào sản xuất trước khi app
-- chính kịp nhập kho. Nhân viên kho ghi tạm mã + LOT gõ tay + KG gõ tay; khi
-- app chính nhập kho và đẩy tồn xuống, app tăng ca đối chiếu lot/KG, gợi ý cuộn
-- đúng để chốt, rồi đưa dòng vào PHIẾU XUẤT KHO HÔM NAY như dòng bình thường.
--
-- ⚠ Bảng RIÊNG, KHÔNG đụng nvl_day_slips / nvl_slip_lines đang chạy. Nhờ vậy cơ
--   chế tự gửi 16h30 (quét phiếu nháp) KHÔNG BAO GIỜ nhìn thấy phiếu tạm — đây
--   là điều kiện an toàn bắt buộc: dòng tạm chưa có cuộn, gửi lên app chính là lỗi.
--
-- Thuần additive: 1 bảng mới + 1 cột mới nullable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Dòng xuất tạm. MỖI DÒNG = MỘT CUỘN (vì app chính xuất nguyên cuộn),
--    nên nhân viên kho lấy 3 cuộn thì ghi 3 dòng, mỗi dòng 1 lot + 1 KG.
--    Phụ liệu không có lot/cuộn → chỉ mã + số lượng.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nvl_temp_lines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch     text NOT NULL CHECK (branch IN ('nvl', 'aux')),

  -- NGÀY XUẤT THỰC TẾ — ngày hàng được đưa vào sản xuất. Có thể KHÁC ngày chốt.
  real_date  date NOT NULL,

  department text NOT NULL DEFAULT 'Heading'
             CHECK (department IN ('Heading', 'Rolling')),

  material_code text NOT NULL,
  material_name text,
  material_spec text,

  -- Gõ tay từ TEM CUỘN. So khớp sẽ đối chiếu ô này với CẢ lot_no LẪN coil_no
  -- bên app chính — hàng Vĩnh Thành không có lot, chỉ có số hiệu cuộn.
  lot_typed  text,
  -- KG gõ tay (NVL) hoặc số lượng (phụ liệu). Với NVL, KG này phải khớp TUYỆT ĐỐI
  -- với trọng lượng cuộn bên app chính thì mới tự gợi ý (user chốt 31/7).
  qty        numeric(14,3) NOT NULL CHECK (qty >= 0),
  unit       text NOT NULL DEFAULT 'KG',
  note       text,

  -- waiting = đang chờ hàng vào app chính · merged = đã chốt và đưa vào phiếu ngày
  status     text NOT NULL DEFAULT 'waiting'
             CHECK (status IN ('waiting', 'merged')),

  -- Kết quả chốt
  merged_at        timestamptz,
  merged_slip_uid  text,        -- phiếu ngày đã nhận dòng này
  merged_coil_id   int,         -- coil.id bên app chính đã ghép (NVL)
  merged_coil_no   text,
  merged_lot_no    text,

  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nvl_temp_status ON nvl_temp_lines (status, real_date);

-- ------------------------------------------------------------
-- 2. Dòng phiếu ngày cần mang theo NGÀY XUẤT THỰC TẾ để app chính soi cảnh báo
--    KHSX đúng ngày sản xuất (không phải ngày phiếu). Rỗng = dòng bình thường.
-- ------------------------------------------------------------
ALTER TABLE nvl_slip_lines ADD COLUMN IF NOT EXISTS real_date date;

-- ------------------------------------------------------------
-- 3. Part mới cho tồn kho đẩy xuống: 'nvl_khsx' đã thêm ở migration 21.
--    Migration này KHÔNG cần part mới — phiếu tạm dùng lại 'nvl_main' + 'nvl_master'.
-- ------------------------------------------------------------
