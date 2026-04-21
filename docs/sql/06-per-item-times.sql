-- Migration 06: Cho phép mỗi dòng trong phiếu tăng ca có giờ riêng
-- Khi admin sửa phiếu: có người về sớm, có người làm thêm giờ → mỗi
-- người cần time_from/time_to/duration_hours riêng.
--
-- Các cột nullable: dòng NULL → fallback về giờ của header phiếu.
-- Dữ liệu cũ không cần backfill, app tự xử lý fallback.

ALTER TABLE overtime_items
  ADD COLUMN IF NOT EXISTS time_from time,
  ADD COLUMN IF NOT EXISTS time_to time,
  ADD COLUMN IF NOT EXISTS duration_hours numeric;
