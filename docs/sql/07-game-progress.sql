-- Migration 07: Lưu tiến độ (sao) game học cho bé.
--
-- AN TOÀN TUYỆT ĐỐI với dữ liệu sản xuất:
--   - Bảng MỚI hoàn toàn, KHÔNG foreign key tới bảng nào.
--   - KHÔNG ALTER / DROP / DELETE bất kỳ bảng cũ.
--   - Chỉ CREATE TABLE IF NOT EXISTS → chạy lại nhiều lần vẫn an toàn.
--   - Blast radius = 0 với overtime_*, users, equipments, daily_plans...
--
-- ⚠️ KHI CHẠY: mở tab SQL Editor MỚI HOÀN TOÀN TRỐNG trên Supabase,
--    chỉ paste đúng đoạn dưới, bấm Run. KHÔNG Run trong tab có query cũ.

CREATE TABLE IF NOT EXISTS game_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile text NOT NULL UNIQUE DEFAULT 'default',
  stars int NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_progress ENABLE ROW LEVEL SECURITY;
-- Không viết policy nào → anon key không đọc/ghi được (chỉ service role
-- của server bypass, giống các bảng khác trong dự án).
