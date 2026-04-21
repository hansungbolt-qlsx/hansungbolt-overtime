import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// --- Nhân viên (14 HD + 11 RL) ---
const employees = [
  { full_name: 'TRẦN ANH TUẤN', department: 'HD', order_no: 1 },
  { full_name: 'NGUYỄN TIẾN DŨNG', department: 'HD', order_no: 2 },
  { full_name: 'NGUYỄN XUÂN QUANG', department: 'HD', order_no: 3 },
  { full_name: 'PHẠM TUẤN VŨ', department: 'HD', order_no: 4 },
  { full_name: 'PHẠM TẤN PHONG', department: 'HD', order_no: 5 },
  { full_name: 'HÀ QUỐC ĐIỆP', department: 'HD', order_no: 6 },
  { full_name: 'PHẠM HỮU ANH', department: 'HD', order_no: 7 },
  { full_name: 'VŨ CÔNG THAO', department: 'HD', order_no: 8 },
  { full_name: 'NGUYỄN ĐỨC GIÁP', department: 'HD', order_no: 9 },
  { full_name: 'NGUYỄN CẢNH THIẾT', department: 'HD', order_no: 10 },
  { full_name: 'NGUYỄN QUỐC BẢO', department: 'HD', order_no: 11 },
  { full_name: 'TRẦN XUÂN ĐẠT', department: 'HD', order_no: 12 },
  { full_name: 'HỨA TẤN ANH', department: 'HD', order_no: 13 },
  { full_name: 'ĐINH MẠNH HOÀNG', department: 'HD', order_no: 14 },
  { full_name: 'BÙI DOÃN TOÀN', department: 'RL', order_no: 1 },
  { full_name: 'DƯƠNG ĐỨC LINH', department: 'RL', order_no: 2 },
  { full_name: 'NGUYỄN VĂN TÙNG (A)', department: 'RL', order_no: 3 },
  { full_name: 'HỒ VĂN BÁU', department: 'RL', order_no: 4 },
  { full_name: 'VÕ VĂN TRÌNH', department: 'RL', order_no: 5 },
  { full_name: 'NGUYỄN VĂN TUẤN', department: 'RL', order_no: 6 },
  { full_name: 'ĐỖ HUY HOÀNG', department: 'RL', order_no: 7 },
  { full_name: 'LÊ ĐÌNH TUẤN', department: 'RL', order_no: 8 },
  { full_name: 'NGUYỄN ANH TÚ', department: 'RL', order_no: 9 },
  { full_name: 'ĐỖ HOÀNG SƠN', department: 'RL', order_no: 10 },
  { full_name: 'LƯƠNG HOÀNG NHÂN', department: 'RL', order_no: 11 },
];

// --- Thiết bị ---
// Helper expand range: HD-15 đến HD-31 → [HD-15, HD-16, ..., HD-31]
function range(
  prefix: string,
  start: number,
  end: number,
  spec: string,
  machine_type: string,
  rpm: number,
  department: 'HD' | 'RL',
) {
  const list = [];
  for (let i = start; i <= end; i++) {
    list.push({
      code: `${prefix}-${String(i).padStart(2, '0')}`,
      department,
      spec,
      machine_type,
      rpm,
    });
  }
  return list;
}

const equipments = [
  // HD — 43 máy (bao gồm HD-1A bổ sung)
  { code: 'HD-01', department: 'HD', spec: 'M12', machine_type: 'FORMER', rpm: 55 },
  { code: 'HD-1A', department: 'HD', spec: 'M16', machine_type: 'FORMER', rpm: 50 },
  { code: 'HD-02', department: 'HD', spec: 'M10', machine_type: 'HEADER', rpm: 45 },
  { code: 'HD-03', department: 'HD', spec: 'M10', machine_type: 'FORMER', rpm: 90 },
  { code: 'HD-04', department: 'HD', spec: 'M10', machine_type: 'FORMER', rpm: 90 },
  { code: 'HD-4A', department: 'HD', spec: 'M10', machine_type: 'FORMER', rpm: 90 },
  { code: 'HD-05', department: 'HD', spec: 'M10', machine_type: 'HEADER', rpm: 55 },
  { code: 'HD-06', department: 'HD', spec: 'M10', machine_type: 'HEADER', rpm: 45 },
  { code: 'HD-07', department: 'HD', spec: 'M8', machine_type: 'FORMER', rpm: 140 },
  { code: 'HD-7A', department: 'HD', spec: 'M8', machine_type: 'FORMER', rpm: 140 },
  { code: 'HD-08', department: 'HD', spec: 'M8', machine_type: 'HEADER', rpm: 55 },
  { code: 'HD-8A', department: 'HD', spec: 'M8', machine_type: 'HEADER', rpm: 55 },
  { code: 'HD-09', department: 'HD', spec: 'M6', machine_type: 'HEADER', rpm: 70 },
  { code: 'HD-9A', department: 'HD', spec: 'M8', machine_type: 'FORMER', rpm: 115 },
  { code: 'HD-9B', department: 'HD', spec: 'M6', machine_type: 'FORMER', rpm: 280 },
  { code: 'HD-10', department: 'HD', spec: 'M6', machine_type: 'HEADER', rpm: 100 },
  { code: 'HD-11', department: 'HD', spec: 'M6', machine_type: 'HEADER', rpm: 110 },
  { code: 'HD-12', department: 'HD', spec: 'M6', machine_type: 'HEADER', rpm: 110 },
  { code: 'HD-13', department: 'HD', spec: 'M6', machine_type: 'HEADER', rpm: 110 },
  { code: 'HD-14', department: 'HD', spec: 'M6', machine_type: 'HEADER', rpm: 110 },
  ...range('HD', 15, 31, 'M4', 'HEADER', 180, 'HD'),
  ...range('HD', 50, 55, 'M3', 'HEADER', 180, 'HD'),

  // RL (25 rolling + 7 SM + 6 CT, tất cả thuộc bộ phận RL) = 38 máy
  { code: 'RL-02', department: 'RL', spec: 'M12', machine_type: 'ROLLING', rpm: 80 },
  { code: 'RL-03', department: 'RL', spec: 'M10', machine_type: 'ROLLING', rpm: 102 },
  { code: 'RL-04', department: 'RL', spec: 'M8', machine_type: 'ROLLING', rpm: 140 },
  ...range('RL', 5, 8, 'M6', 'ROLLING', 140, 'RL'),
  ...range('RL', 9, 14, 'M4', 'ROLLING (T/S-1)', 215, 'RL'),
  ...range('RL', 15, 23, 'M4', 'ROLLING', 215, 'RL'),
  { code: 'RL-24', department: 'RL', spec: 'M4', machine_type: 'ROLLING', rpm: 60 },
  ...range('RL', 40, 42, 'M3', 'ROLLING', 350, 'RL'),

  // SM (thuộc RL)
  { code: 'SM-01', department: 'RL', spec: 'M12', machine_type: 'SEM ROLLING', rpm: 100 },
  { code: 'SM-02', department: 'RL', spec: 'M8', machine_type: 'SEM ROLLING', rpm: 110 },
  { code: 'SM-2A', department: 'RL', spec: 'M8', machine_type: 'SEM ROLLING', rpm: 110 },
  { code: 'SM-03', department: 'RL', spec: 'M6', machine_type: 'SEM ROLLING', rpm: 140 },
  { code: 'SM-04', department: 'RL', spec: 'M4', machine_type: 'SEM ROLLING', rpm: 210 },
  { code: 'SM-05', department: 'RL', spec: 'M4', machine_type: 'SEM ROLLING', rpm: 210 },
  { code: 'SM-06', department: 'RL', spec: 'M3', machine_type: 'SEM ROLLING', rpm: 210 },

  // CT — Cutting (thuộc RL)
  ...range('CT', 1, 6, 'M3-M6', 'CUTTING', 215, 'RL'),
];

async function seed() {
  console.log('→ Đang nạp nhân viên...');
  const { error: empErr } = await supabase.from('employees').insert(employees);
  if (empErr) throw empErr;
  console.log(`  ✓ ${employees.length} nhân viên`);

  console.log('→ Đang nạp thiết bị...');
  const { error: eqErr } = await supabase.from('equipments').insert(equipments);
  if (eqErr) throw eqErr;
  console.log(`  ✓ ${equipments.length} thiết bị`);

  console.log('→ Đang nạp tài khoản (hash bcrypt)...');
  const users = [
    {
      username: 'qlsx',
      full_name: 'Hoàng Chính Hữu',
      role: 'admin',
      department: null,
      password_hash: await bcrypt.hash('qlsx123', 10),
    },
    {
      username: 'hd',
      full_name: 'Trần Anh Tuấn',
      role: 'leader',
      department: 'HD',
      password_hash: await bcrypt.hash('hd123', 10),
    },
    {
      username: 'rl',
      full_name: 'Bùi Doãn Toàn',
      role: 'leader',
      department: 'RL',
      password_hash: await bcrypt.hash('rl123', 10),
    },
  ];
  const { error: uErr } = await supabase.from('users').insert(users);
  if (uErr) throw uErr;
  console.log(`  ✓ ${users.length} tài khoản (qlsx, hd, rl)`);

  console.log('\n🎉 Seed hoàn tất.');
}

seed().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
