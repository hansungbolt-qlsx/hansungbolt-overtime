-- ============================================================
-- Migration 30: KHO SƠN COATING — phiếu xuất sơn / hoá chất (anh Hữu chốt 11/11/2026)
--
-- Tổ trưởng Coating lập PHIẾU XUẤT trên app tăng ca (tab 🎨 Kho sơn) → bấm Gửi → agent nhận qua REALTIME
-- → đẩy sang APP CHÍNH (lưu vĩnh viễn, tính Tồn Main theo lô + Tồn Line, trả lên app Coating qua cổng LAN).
-- Supabase chỉ là HỘP THƯ, giống gc_slips: 1 phiếu = 1 dòng, các dòng xuất để dạng JSON → sửa phiếu = ghi đè 1 dòng.
-- Lịch sử sửa/huỷ cũng nằm trong dòng đó (cột history) — không thêm bảng.
--
-- TỒN (Main theo lô + Line theo loại sơn) KHÔNG ở bảng: agent đẩy 1 file plan-files/kho-son.json (Storage,
-- ghi đè, chỉ khi tồn đổi) — không thêm bảng, không phình CSDL.
--
-- Thuần additive: 1 bảng mới + thêm bảng vào publication Realtime. Không đụng dữ liệu cũ.
-- An toàn chạy lại (IF NOT EXISTS / kiểm publication).
-- ⚠ Chạy trên Supabase SQL Editor TRƯỚC khi deploy code app tăng ca.
-- Lùi: ALTER PUBLICATION supabase_realtime DROP TABLE co_paint_slips;  DROP TABLE co_paint_slips;
-- ============================================================

CREATE TABLE IF NOT EXISTS co_paint_slips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_phieu        text NOT NULL UNIQUE,                 -- 'XS-yyMMdd-NN' — khoá gửi sang app chính, không đổi
  ngay            date NOT NULL,                        -- ngày xuất (giờ Việt Nam)
  -- pending   = ⏳ đã Gửi, chờ app chính nhận
  -- synced    = ● app chính đã nhận bản hiện tại (main_version = version)
  -- cancelled = ✖ đã huỷ (không xoá — app chính cộng lại tồn)
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'cancelled')),
  version         int  NOT NULL DEFAULT 1,              -- tăng 1 mỗi lần sửa / huỷ
  -- [{line_id, product_id, product_name, unit ('kg'|'lit'), loai ('son'|'hoa_chat'), lot_id, lot_no, exp_date,
  --   qty, thung (sơn: số thùng nguyên), het_han (bool), doi_lo_ly_do}]
  -- line_id CỐ ĐỊNH ('XS-yyMMdd-NN-k') — app Coating thay theo mã, không trừ 2 lần
  lines           jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{v, by, at, reason, action ('sua'|'huy'), before: lines cũ}]
  history         jsonb NOT NULL DEFAULT '[]'::jsonb,
  note            text,
  cancel_reason   text,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,   -- người lập — chỉ người này sửa/huỷ, trong 7 ngày
  created_by_name text,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  synced_at       timestamptz,                          -- agent đã đẩy BẢN HIỆN TẠI sang app chính (NULL = chưa)
  main_version    int,                                  -- version app chính đã nhận
  last_error      text,                                 -- lỗi app chính trả về khi nhận
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_co_paint_slips_sync ON co_paint_slips (status, synced_at);
CREATE INDEX IF NOT EXISTS idx_co_paint_slips_ngay ON co_paint_slips (ngay DESC);

ALTER TABLE co_paint_slips ENABLE ROW LEVEL SECURITY;  -- như các bảng khác: chỉ service key (server + agent) đọc/ghi

-- Realtime: agent nhận ngay khi có phiếu Gửi / sửa / huỷ (không phải hỏi dày → giữ hạn mức Free)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'co_paint_slips') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE co_paint_slips;
  END IF;
END $$;

-- Kiểm sau khi chạy (phải ra 1 dòng):
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'co_paint_slips';
