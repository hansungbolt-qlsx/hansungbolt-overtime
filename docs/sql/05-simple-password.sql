-- ============================================================
-- Migration 05: Đơn giản hóa mật khẩu
-- - Thêm cột password_plain để admin xem được mật khẩu hiện tại
-- - Reset toàn bộ mật khẩu user (trừ admin) về 'hd123'
-- ============================================================

-- 1. Thêm cột lưu plaintext (dùng cho admin xem + đối chiếu)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- 2. Reset toàn bộ user (trừ admin) về 'hd123'
UPDATE users
SET
  password_hash  = crypt('hd123', gen_salt('bf', 10)),
  password_plain = 'hd123'
WHERE role <> 'admin';

-- Kiểm tra:
-- SELECT username, full_name, role, department, password_plain FROM users ORDER BY role, department, full_name;
