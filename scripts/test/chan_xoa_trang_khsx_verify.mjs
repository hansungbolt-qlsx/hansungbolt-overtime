/**
 * BÀI KIỂM — CHẶN XOÁ TRẮNG KHSX khi không dòng nào khớp danh sách máy.
 *
 * Vá 13/08/2026 (rà soát sau sự cố mất 27 dòng phiếu xuất NVL):
 * `POST /api/upload-plan` xoá kế hoạch của ngày đó VÔ ĐIỀU KIỆN rồi mới ghi lại,
 * mà ghi lại thì `if (records.length > 0)`. File KHSX vẫn đủ dòng nhưng nếu KHÔNG
 * mã máy nào khớp bảng `equipments` thì `records = 0` ⇒ mất trắng KHSX hôm đó.
 *
 * Bài kiểm chạy THẬT qua route, trên ngày vứt đi 2099-01-01. Dọn sạch sau khi chạy.
 *   node scripts/test/chan_xoa_trang_khsx_verify.mjs [http://127.0.0.1:3000]
 */
import { readFileSync } from 'node:fs';
import { SignJWT } from 'jose';
import * as XLSX from 'xlsx';

const GOC = process.argv[2] || 'http://127.0.0.1:3000';
const NGAY = '2099-01-01';
const SHEET = 'KH';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const _u = await fetch(`${SB}/rest/v1/users?select=id&limit=1`, { headers: H });
const [nguoi] = await _u.json();
const token = await new SignJWT({
  userId: nguoi.id, username: 'kiemthu', fullName: 'BÀI KIỂM KHSX', role: 'admin',
}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1d')
  .sign(new TextEncoder().encode(env.JWT_SECRET));

/** Lấy vài mã máy HD CÓ THẬT rồi đổi về dạng VIẾT TẮT như file KHSX vẫn ghi.
 *  ⚠ File KHSX ghi "1", "9B" chứ KHÔNG ghi "HD-01" — `expandMachineCode` chỉ nhận
 *    dạng viết tắt (`lib/parse-plan.ts:35` khớp /^(\d+)([A-Z])?$/). Bài kiểm bản
 *    đầu ghi thẳng "HD-01" nên bước "file hợp lệ" hỏng, kéo theo phép kiểm chính
 *    ở bước 2 ĐẠT MỘT CÁCH VÔ NGHĨA (không có kế hoạch nào để mà bảo vệ). */
const rEq = await fetch(`${SB}/rest/v1/equipments?department=eq.HD&select=code&limit=6`,
                        { headers: H });
const mayThat = (await rEq.json())
  .map((e) => String(e.code).replace(/^HD-?0*/i, ''))     // HD-01 → 1 · HD-9B → 9B
  .filter((s) => /^\d+[A-Z]?$/i.test(s));
if (mayThat.length < 2) { console.log('🛑 Không đủ máy HD để dựng file kiểm'); process.exit(1); }
console.log(`Máy HD có thật (dạng viết tắt như file KHSX): ${mayThat.join(', ')}`);

function dungFile(dsMay) {
  const aoa = [['SỐ MÁY', 'MÃ SẢN PHẨM'], ...dsMay.map((m, i) => [m, `KIEMTHU-${i + 1}`])];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), SHEET);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function upload(dsMay) {
  const fd = new FormData();
  fd.append('sheet', SHEET);
  fd.append('plan_date', NGAY);
  fd.append('file', new Blob([dungFile(dsMay)]), 'kiemthu.xlsx');
  const r = await fetch(`${GOC}/api/upload-plan`, {
    method: 'POST', headers: { cookie: `session=${token}` }, body: fd,
  });
  let d = {};
  try { d = await r.json(); } catch { d = { error: '(không phải JSON)' }; }
  if (r.status >= 500) console.log('      ↳ lỗi máy chủ:', JSON.stringify(d).slice(0, 300));
  return { status: r.status, data: d };
}

async function demKeHoach() {
  const r = await fetch(`${SB}/rest/v1/daily_plans?plan_date=eq.${NGAY}&select=id`,
                        { headers: H });
  return (await r.json()).length;
}
async function don() {
  await fetch(`${SB}/rest/v1/daily_plans?plan_date=eq.${NGAY}`, { method: 'DELETE', headers: H });
  const r = await fetch(`${SB}/rest/v1/plan_files?plan_date=eq.${NGAY}&select=id`, { headers: H });
  for (const f of await r.json()) {
    await fetch(`${SB}/rest/v1/plan_files?id=eq.${f.id}`, { method: 'DELETE', headers: H });
  }
}

let dat = 0, hong = 0;
const kiem = (ok, ten, them = '') => {
  console.log(`   ${ok ? '✓' : '✗'} ${ten}${them ? ` — ${them}` : ''}`);
  ok ? dat++ : hong++;
};

console.log('Dọn dữ liệu kiểm thử cũ…');
await don();
try {
  console.log('\n1. Upload file HỢP LỆ (mã máy có thật) → phải ghi được kế hoạch');
  let r = await upload(mayThat);
  kiem(r.status === 200, 'trả 200', `status=${r.status} ${r.data.error ?? ''}`);
  const n1 = await demKeHoach();
  kiem(n1 > 0, 'đã ghi kế hoạch', `${n1} dòng`);

  console.log('\n2. ⭐ Upload file mã máy TOÀN SAI → phải TỪ CHỐI và GIỮ kế hoạch cũ');
  r = await upload(['MAY-KHONG-CO-1', 'MAY-KHONG-CO-2', 'MAY-KHONG-CO-3']);
  kiem(r.status === 400, 'trả 400', `status=${r.status}`);
  kiem(r.data.code === 'PLAN_EMPTY', 'đúng mã lỗi PLAN_EMPTY', String(r.data.code));
  kiem(Array.isArray(r.data.warnings) && r.data.warnings.length > 0,
       'có kèm cảnh báo nói rõ máy nào bị bỏ',
       `${r.data.warnings?.length ?? 0} cảnh báo`);
  const n2 = await demKeHoach();
  // ⚠ Phải có n1 > 0 thì phép này mới có nghĩa — không thì "còn nguyên 0 dòng"
  //   là ĐẠT VÌ LÝ DO SAI (bản đầu của bài kiểm đã dính đúng bẫy này).
  kiem(n1 > 0 && n2 === n1, '🔴 KẾ HOẠCH CŨ VẪN CÒN NGUYÊN — không bị xoá',
       `trước ${n1} → sau ${n2}${n1 === 0 ? '  ⚠ VÔ NGHĨA vì bước 1 hỏng' : ''}`);

  console.log('\n3. Upload lại file hợp lệ → vẫn thay được kế hoạch bình thường');
  r = await upload([mayThat[0]]);
  kiem(r.status === 200, 'trả 200', `status=${r.status}`);
  const n3 = await demKeHoach();
  kiem(n3 > 0 && n3 <= n1, 'kế hoạch đã được thay', `${n1} → ${n3} dòng`);
} finally {
  console.log('\nDọn dữ liệu kiểm thử…');
  await don();
  kiem(await demKeHoach() === 0, 'đã dọn sạch kế hoạch ngày 2099');
}

console.log(`\n${'='.repeat(60)}`);
console.log(hong === 0 ? `✅ ĐẠT ${dat}/${dat} phép kiểm` : `🛑 HỎNG ${hong}, đạt ${dat}`);
console.log('='.repeat(60));
process.exit(hong === 0 ? 0 : 1);
