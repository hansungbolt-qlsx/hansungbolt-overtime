-- ============================================================
-- Migration 04: Multi-user system
-- - Thêm role 'worker'
-- - Cho phép xóa user (registered_by → SET NULL)
-- - Wipe user cũ (giữ lại admin) + dữ liệu test cũ
-- - Seed 25 user mới (14 HD + 11 RL) với password = username
-- ============================================================

-- 1. Cho phép registered_by NULL + ON DELETE SET NULL
ALTER TABLE overtime_registrations
  ALTER COLUMN registered_by DROP NOT NULL;

ALTER TABLE overtime_registrations
  DROP CONSTRAINT IF EXISTS overtime_registrations_registered_by_fkey;

ALTER TABLE overtime_registrations
  ADD CONSTRAINT overtime_registrations_registered_by_fkey
  FOREIGN KEY (registered_by) REFERENCES users(id) ON DELETE SET NULL;

-- 2. Mở rộng role check để chấp nhận 'worker'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'leader', 'worker'));

-- 3. Wipe dữ liệu test cũ + user cũ (giữ admin)
DELETE FROM overtime_items;
DELETE FROM overtime_registrations;
DELETE FROM users WHERE role <> 'admin';

-- 4. Seed 25 user mới
-- Password = username, hash bằng bcrypt qua pgcrypto
-- Helper: gen_salt('bf', 10) tạo salt cost 10
INSERT INTO users (username, full_name, role, department, password_hash) VALUES
  -- HD leaders (3)
  ('trananhtuan',     'TRẦN ANH TUẤN',     'leader', 'HD', crypt('trananhtuan',     gen_salt('bf', 10))),
  ('phamhuuanh',      'PHẠM HỮU ANH',      'leader', 'HD', crypt('phamhuuanh',      gen_salt('bf', 10))),
  ('nguyentiendung',  'NGUYỄN TIẾN DŨNG',  'leader', 'HD', crypt('nguyentiendung',  gen_salt('bf', 10))),
  -- HD workers (11)
  ('nguyenxuanquang', 'NGUYỄN XUÂN QUANG', 'worker', 'HD', crypt('nguyenxuanquang', gen_salt('bf', 10))),
  ('phamtuanvu',      'PHẠM TUẤN VŨ',      'worker', 'HD', crypt('phamtuanvu',      gen_salt('bf', 10))),
  ('phamtanphong',    'PHẠM TẤN PHONG',    'worker', 'HD', crypt('phamtanphong',    gen_salt('bf', 10))),
  ('haquocdiep',      'HÀ QUỐC ĐIỆP',      'worker', 'HD', crypt('haquocdiep',      gen_salt('bf', 10))),
  ('vucongthao',      'VŨ CÔNG THAO',      'worker', 'HD', crypt('vucongthao',      gen_salt('bf', 10))),
  ('nguyenducgiap',   'NGUYỄN ĐỨC GIÁP',   'worker', 'HD', crypt('nguyenducgiap',   gen_salt('bf', 10))),
  ('nguyencanhthiet', 'NGUYỄN CẢNH THIẾT', 'worker', 'HD', crypt('nguyencanhthiet', gen_salt('bf', 10))),
  ('nguyenquocbao',   'NGUYỄN QUỐC BẢO',   'worker', 'HD', crypt('nguyenquocbao',   gen_salt('bf', 10))),
  ('tranxuandat',     'TRẦN XUÂN ĐẠT',     'worker', 'HD', crypt('tranxuandat',     gen_salt('bf', 10))),
  ('huatananh',       'HỨA TẤN ANH',       'worker', 'HD', crypt('huatananh',       gen_salt('bf', 10))),
  ('dinhmanhhoang',   'ĐINH MẠNH HOÀNG',   'worker', 'HD', crypt('dinhmanhhoang',   gen_salt('bf', 10))),

  -- RL leaders (3)
  ('buidoantoan',     'BÙI DOÃN TOÀN',     'leader', 'RL', crypt('buidoantoan',     gen_salt('bf', 10))),
  ('nguyenvantung',   'NGUYỄN VĂN TÙNG',   'leader', 'RL', crypt('nguyenvantung',   gen_salt('bf', 10))),
  ('duongduclinh',    'DƯƠNG ĐỨC LINH',    'leader', 'RL', crypt('duongduclinh',    gen_salt('bf', 10))),
  -- RL workers (8)
  ('hovanbau',        'HỒ VĂN BÁU',        'worker', 'RL', crypt('hovanbau',        gen_salt('bf', 10))),
  ('vovantrinh',      'VÕ VĂN TRÌNH',      'worker', 'RL', crypt('vovantrinh',      gen_salt('bf', 10))),
  ('nguyenvantuan',   'NGUYỄN VĂN TUẤN',   'worker', 'RL', crypt('nguyenvantuan',   gen_salt('bf', 10))),
  ('dohuyhoang',      'ĐỖ HUY HOÀNG',      'worker', 'RL', crypt('dohuyhoang',      gen_salt('bf', 10))),
  ('ledinhtuan',      'LÊ ĐÌNH TUẤN',      'worker', 'RL', crypt('ledinhtuan',      gen_salt('bf', 10))),
  ('nguyenanhtu',     'NGUYỄN ANH TÚ',     'worker', 'RL', crypt('nguyenanhtu',     gen_salt('bf', 10))),
  ('dohoangson',      'ĐỖ HOÀNG SƠN',      'worker', 'RL', crypt('dohoangson',      gen_salt('bf', 10))),
  ('luonghoangnhan',  'LƯƠNG HOÀNG NHÂN',  'worker', 'RL', crypt('luonghoangnhan',  gen_salt('bf', 10)));

-- Kiểm tra: phải có 26 user (1 admin + 25 mới)
-- SELECT count(*) FROM users;
-- SELECT role, department, count(*) FROM users GROUP BY role, department ORDER BY role, department;
