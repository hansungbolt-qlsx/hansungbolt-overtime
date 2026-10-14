-- ============================================================
-- Migration 26: NHẬP LIỆU GIA CÔNG 70/80 (tài khoản qlsx) — anh Hữu chốt 14/10/2026
--
-- Điện thoại (qlsx) lập PHIẾU ĐẶT hoặc PHIẾU NHẬP gia công công đoạn 70/80: chọn công đoạn + nhà gia công,
-- quét phiếu di chuyển (DCCD) ra số chỉ thị, gõ kg (số nguyên) → Lưu / Gửi → agent nhận qua REALTIME
-- → đẩy sang APP CHÍNH (lưu vĩnh viễn, huu duyệt, Đẩy ERP) → trạng thái duyệt agent ghi ngược về đây.
-- Supabase chỉ là HỘP THƯ. Dòng phiếu để dạng JSON trong 1 cột (1 phiếu = 1 dòng) — sửa phiếu = ghi đè 1 dòng.
--
-- Danh sách chỉ thị chờ đặt + thùng chờ về KHÔNG ở bảng: agent đẩy 1 file plan-files/gc-guong.json (Storage,
-- ghi đè, chỉ khi dữ liệu đổi) — không thêm bảng, không phình CSDL.
--
-- Thuần additive: 1 bảng mới + thêm bảng vào publication Realtime. Không đụng dữ liệu cũ.
-- An toàn chạy lại (IF NOT EXISTS / kiểm publication).
-- ⚠ Chạy trên Supabase SQL Editor TRƯỚC khi deploy code app tăng ca.
-- Lùi: ALTER PUBLICATION supabase_realtime DROP TABLE gc_slips;  DROP TABLE gc_slips;
-- ============================================================

CREATE TABLE IF NOT EXISTS gc_slips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid             text NOT NULL UNIQUE,                 -- 'GC-D-YYYYMMDD-HHMMSS-xxxx' — khoá gửi sang app chính
  loai            text NOT NULL CHECK (loai IN ('dat', 'nhap')),
  cong_doan       text NOT NULL CHECK (cong_doan IN ('70', '80')),
  ncc             text NOT NULL,                        -- mã nhà gia công ERP (NPT, VIK, TC…)
  -- draft    = 📝 đang lập (sửa thoải mái)
  -- pending  = 📤 đã Gửi, chờ app chính duyệt
  -- approved = ✅ app chính đã duyệt · pushed = 🏭 đã đẩy lên ERP (erp_ref) · rejected = ↩ trả lại (reject_reason)
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'pushed', 'rejected')),
  lines           jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{saeji_no, ma_hang, ten_hang, kg, dat_no?, dat_seq?, hoan_thanh?}]
  note            text,
  created_by_name text,
  sent_at         timestamptz,
  synced_at       timestamptz,                          -- agent đã đẩy BẢN HIỆN TẠI sang app chính (NULL = chưa)
  last_error      text,                                 -- lỗi app chính trả về khi nhận (vd chỉ thị không mở)
  reject_reason   text,
  approved_by     text,
  approved_at     timestamptz,
  erp_ref         text,                                 -- số phiếu ERP sau khi đẩy
  main_version    int,                                  -- version phiếu bên app chính
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gc_slips_status ON gc_slips (status, synced_at);
CREATE INDEX IF NOT EXISTS idx_gc_slips_created ON gc_slips (created_at DESC);

ALTER TABLE gc_slips ENABLE ROW LEVEL SECURITY;      -- như các bảng khác: chỉ service key (server + agent) đọc/ghi

-- Realtime: agent nhận ngay khi có phiếu Gửi (không phải hỏi dày → giữ hạn mức Free)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'gc_slips') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gc_slips;
  END IF;
END $$;

-- Kiểm sau khi chạy (phải ra 1 dòng):
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'gc_slips';
