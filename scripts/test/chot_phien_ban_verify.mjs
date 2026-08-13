/**
 * BÀI KIỂM — CHỐT PHIÊN BẢN khi lưu phiếu xuất/trả kho NPL.
 *
 * Vá lỗi 13/08/2026: phiếu `ot-2026-08-13-issue-nvl-1` mất 27 dòng / 7.192 Kg vì
 * `POST /api/nvl-slips` xoá sạch dòng cũ rồi ghi lại theo rổ của điện thoại, mà
 * rổ lúc đó RỖNG. Nay máy phải gửi kèm `base_n_lines`; lệch là máy chủ TỪ CHỐI.
 *
 * Bài kiểm chạy THẬT qua route, nhưng trên phiếu VỨT ĐI ngày 2099-01-01 nên
 * không chạm phiếu thật. Dọn sạch sau khi chạy.
 *
 * Cách chạy:  node scripts/test/chot_phien_ban_verify.mjs [http://127.0.0.1:3000]
 * (cần `npm run dev` đang chạy ở cổng đó)
 */
import { readFileSync } from 'node:fs';
import { SignJWT } from 'jose';

const GOC = process.argv[2] || 'http://127.0.0.1:3000';
const NGAY = '2099-01-01';                    // ngày vứt đi, không đụng dữ liệu thật

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

// `nvl_day_slips.created_by` có khoá ngoại sang bảng người dùng → phải mượn một
// id CÓ THẬT. Phiếu kiểm thử nằm ở ngày 2099 và bị xoá sạch cuối bài.
const _u = await fetch(`${SB}/rest/v1/users?select=id,username,role&limit=1`,
                       { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
const [nguoi] = await _u.json();
if (!nguoi?.id) { console.log('🛑 Không lấy được người dùng nào để mượn id'); process.exit(1); }
console.log(`Mượn id người dùng có thật: ${nguoi.username} (${nguoi.role})`);

const token = await new SignJWT({
  userId: nguoi.id,
  username: 'kiemthu', fullName: 'BÀI KIỂM CHỐT PHIÊN BẢN', role: 'qlsx',
}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1d')
  .sign(new TextEncoder().encode(env.JWT_SECRET));

const dong = (n, kg) => ({
  batch_seq: n, batch_time: '08:00', department: 'Heading',
  material_code: `KIEMTHU${n}`, material_name: 'DONG KIEM THU', qty: kg, unit: 'KG',
});

async function luu(lines, base) {
  const body = { kind: 'issue', branch: 'nvl', date: NGAY, send: false, lines };
  if (base !== undefined) body.base_n_lines = base;
  const r = await fetch(`${GOC}/api/nvl-slips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: `session=${token}` },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await r.json(); } catch { data = { error: '(không phải JSON)' }; }
  if (r.status >= 500) console.log('      ↳ lỗi máy chủ:', JSON.stringify(data).slice(0, 400));
  return { status: r.status, data };
}

async function demDong() {
  const r = await fetch(
    `${SB}/rest/v1/nvl_day_slips?slip_date=eq.${NGAY}&select=id`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const s = await r.json();
  if (!s.length) return 0;
  const r2 = await fetch(
    `${SB}/rest/v1/nvl_slip_lines?slip_id=eq.${s[0].id}&select=id`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  return (await r2.json()).length;
}

/** Nhật ký mới nhất của phiếu kiểm thử. */
async function nhatKyMoiNhat() {
  const r = await fetch(
    `${SB}/rest/v1/nvl_day_slips?slip_date=eq.${NGAY}&select=uid`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const s = await r.json();
  if (!s.length) return null;
  const r2 = await fetch(
    `${SB}/rest/v1/nvl_slip_events?slip_uid=eq.${s[0].uid}&order=at.desc&limit=1&select=*`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  return (await r2.json())[0] ?? null;
}

async function don() {
  const r = await fetch(`${SB}/rest/v1/nvl_day_slips?slip_date=eq.${NGAY}&select=id,uid`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  for (const s of await r.json()) {
    const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
    await fetch(`${SB}/rest/v1/nvl_slip_lines?slip_id=eq.${s.id}`, { method: 'DELETE', headers: h });
    await fetch(`${SB}/rest/v1/nvl_slip_events?slip_uid=eq.${s.uid}`, { method: 'DELETE', headers: h });
    await fetch(`${SB}/rest/v1/nvl_day_slips?id=eq.${s.id}`, { method: 'DELETE', headers: h });
  }
}

let dat = 0, hong = 0;
function kiem(ok, ten, them = '') {
  console.log(`   ${ok ? '✓' : '✗'} ${ten}${them ? ` — ${them}` : ''}`);
  ok ? dat++ : hong++;
}

console.log('Dọn dữ liệu kiểm thử cũ (nếu có)…');
await don();

try {
  console.log('\n1. Tạo phiếu mới 2 dòng (phiếu chưa tồn tại → không cần mốc)');
  let r = await luu([dong(1, 100), dong(1, 200)], 0);
  kiem(r.status === 200 && r.data.n_lines === 2, 'tạo được phiếu 2 dòng',
       `status=${r.status}`);
  kiem(await demDong() === 2, 'máy chủ có 2 dòng');

  console.log('\n2. Thêm dòng ĐÚNG mốc (base=2, gửi 3 dòng) → phải cho qua');
  r = await luu([dong(1, 100), dong(1, 200), dong(2, 50)], 2);
  kiem(r.status === 200 && r.data.n_lines === 3, 'lưu được 3 dòng', `status=${r.status}`);
  kiem(await demDong() === 3, 'máy chủ có 3 dòng');

  console.log('\n3. ⭐ CA GÂY LỖI 13/08: rổ rỗng, base=0, gửi 1 dòng → phải TỪ CHỐI');
  r = await luu([dong(1, 999)], 0);
  kiem(r.status === 409, 'máy chủ trả 409', `status=${r.status}`);
  kiem(r.data.code === 'VERSION_MISMATCH', 'đúng mã lỗi VERSION_MISMATCH',
       String(r.data.code));
  kiem(r.data.server_n_lines === 3 && r.data.client_base === 0,
       'báo đúng 3 dòng thật vs 0 dòng máy biết');
  const con = await demDong();
  kiem(con === 3, '🔴 3 DÒNG CŨ VẪN CÒN NGUYÊN — không bị xoá', `đếm được ${con}`);

  console.log('\n4. Máy bản cũ, KHÔNG gửi mốc → phải TỪ CHỐI');
  r = await luu([dong(1, 111)], undefined);
  kiem(r.status === 409 && r.data.code === 'BASE_MISSING',
       'trả 409 BASE_MISSING', `status=${r.status} code=${r.data.code}`);
  kiem(await demDong() === 3, '3 dòng cũ vẫn còn nguyên');

  console.log('\n5. Xoá bớt dòng CÓ CHỦ Ý (base=3, gửi 2 dòng) → vẫn phải cho qua');
  r = await luu([dong(1, 100), dong(1, 200)], 3);
  kiem(r.status === 200 && r.data.n_lines === 2, 'cho phép xoá bớt dòng',
       `status=${r.status}`);
  kiem(await demDong() === 2, 'máy chủ còn 2 dòng');

  console.log('\n6. Mốc cũ sau khi phiếu đã đổi (base=3 nhưng thật là 2) → TỪ CHỐI');
  r = await luu([dong(1, 100), dong(1, 200), dong(3, 77)], 3);
  kiem(r.status === 409, 'trả 409', `status=${r.status}`);
  kiem(await demDong() === 2, '2 dòng vẫn còn nguyên');

  console.log('\n7. LƯỚI AN TOÀN — lần lưu làm NGẮN ĐI phải chụp lại dòng cũ');
  const e5 = await nhatKyMoiNhat();
  kiem(Array.isArray(e5?.detail?.truoc), 'nhật ký của bước 5 có khoá `truoc`',
       `truoc=${e5?.detail?.truoc ? `${e5.detail.truoc.length} dòng` : 'KHÔNG CÓ'}`);
  kiem(e5?.detail?.truoc?.length === 3,
       'chụp đúng 3 dòng CŨ (trước khi rút còn 2)');
  const kg5 = (e5?.detail?.truoc ?? []).reduce((s, l) => s + Number(l.qty), 0);
  kiem(kg5 === 350, 'tổng Kg dòng cũ đúng 350 (100+200+50)', `đo được ${kg5}`);
  kiem((e5?.detail?.truoc ?? []).every((l) => l.material_code && l.coil_no !== undefined),
       'mỗi dòng chụp có mã NVL và số cuộn — đủ để dựng lại');

  console.log('\n8. Lần lưu THÊM dòng thì KHÔNG chụp (khỏi phình nhật ký)');
  r = await luu([dong(1, 100), dong(1, 200), dong(2, 60)], 2);
  kiem(r.status === 200, 'lưu được 3 dòng', `status=${r.status}`);
  const e8 = await nhatKyMoiNhat();
  kiem(e8?.detail?.truoc === undefined, 'nhật ký KHÔNG có khoá `truoc`',
       `truoc=${JSON.stringify(e8?.detail?.truoc)}`);
} finally {
  console.log('\nDọn dữ liệu kiểm thử…');
  await don();
  const sach = await demDong();
  kiem(sach === 0, 'đã dọn sạch phiếu kiểm thử', `còn ${sach} dòng`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(hong === 0 ? `✅ ĐẠT ${dat}/${dat} phép kiểm` : `🛑 HỎNG ${hong}, đạt ${dat}`);
console.log('='.repeat(60));
process.exit(hong === 0 ? 0 : 1);
