// BÀI KIỂM — MÁY DỪNG RL: tự chép danh sách hôm trước + dòng tự chép đi theo ngày nguồn + giờ nhắc
// (anh Hữu duyệt 06/11/2026).
//
// Chạy ĐÚNG code thật: route GET/POST /api/stop-reasons + lib/stop-carry — trên SUPABASE GIẢ trong bộ
// nhớ (_gia_lap/), KHÔNG ghi Supabase thật, không gọi mạng. Giờ "hiện tại" đặt giả qua Date.now.
//   npx tsx --require ./scripts/test/_gia_lap/dang-ky.cjs scripts/test/may_dung_rl_tu_chep_verify.ts
import { db, datLai, nhatKy } from './_gia_lap/supabase-gia.mjs';
import { datPhien } from './_gia_lap/auth-gia.mjs';
import { GET, POST } from '../../app/api/stop-reasons/route';
import {
  addDaysISO, carryLabel, isCarryName, isSundayISO, isoVN, remindDue,
} from '../../lib/stop-carry-shared';

let pass = 0;
let fail = 0;
function ok(cond: unknown, msg: string) {
  if (cond) pass++;
  else { fail++; console.log('  ✗ ' + msg); }
}
function eq(a: unknown, b: unknown, msg: string) {
  const sa = JSON.stringify(a); const sb = JSON.stringify(b);
  ok(sa === sb, `${msg}\n      có:   ${sa}\n      mong: ${sb}`);
}

// ── giờ giả: mốc giờ VN → Date.now (UTC) ──
const goc = Date.now;
function datGio(isoVNTime: string) {   // '2026-11-07T09:00'
  const ms = Date.parse(`${isoVNTime}:00Z`) - 7 * 3600 * 1000;
  Date.now = () => ms;
}

const ADMIN = { userId: 'u-admin', role: 'admin', department: null, username: 'ad', fullName: 'Admin' };
const RL = { userId: 'u-rl', role: 'leader', department: 'RL', username: 'rl', fullName: 'Tổ trưởng RL' };
const HDL = { userId: 'u-hd', role: 'leader', department: 'HD', username: 'hd', fullName: 'Tổ trưởng HD' };

type Row = {
  stop_date: string; machine_code: string; department: string; reason_code: string;
  reason_text: string | null; created_by: string | null; created_by_name: string | null; dismissed: boolean;
};

function nap() {
  datLai();
  db.equipments.push(
    { id: 'e1', code: 'RL-02', department: 'RL', machine_type: 'RL' },
    { id: 'e2', code: 'RL-24', department: 'RL', machine_type: 'RL' },
    { id: 'e3', code: 'SM-06', department: 'RL', machine_type: 'SM' },
    { id: 'e4', code: 'CT-01', department: 'RL', machine_type: 'CT' },
    { id: 'e5', code: 'SM-2A', department: 'RL', machine_type: 'SM' },
    { id: 'e6', code: 'CVK-RL', department: 'RL', machine_type: 'OTHER' },
    { id: 'e7', code: 'HD-01', department: 'HD', machine_type: 'HD' },
    { id: 'e8', code: 'HD-02', department: 'HD', machine_type: 'HD' },
  );
}
function them(r: Partial<Row> & { stop_date: string; machine_code: string; reason_code: string }) {
  db.machine_stop_reasons.push({
    id: `x${db.machine_stop_reasons.length}`, department: r.machine_code.startsWith('HD') ? 'HD' : 'RL',
    reason_text: null, created_by: 'u-x', created_by_name: 'Người ghi', dismissed: false,
    created_at: 'c', updated_at: 'u', ...r,
  });
}
const dong = (d: string) => (db.machine_stop_reasons as Row[])
  .filter((r) => r.stop_date === d)
  .sort((a, b) => a.machine_code.localeCompare(b.machine_code));
const tom = (d: string) => dong(d).map((r) =>
  `${r.machine_code}:${r.reason_code}${r.reason_text ? '/' + r.reason_text : ''}:${r.dismissed ? 'BỎ' : 'dừng'}:${r.created_by_name}`);

async function get(date?: string, all = false) {
  const q = new URLSearchParams();
  if (date) q.set('date', date);
  if (all) q.set('all', '1');
  const r = await GET(new Request(`http://x/api/stop-reasons?${q}`));
  return { status: r.status, json: await r.json() };
}
async function post(body: unknown) {
  const r = await POST(new Request('http://x/api/stop-reasons', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }));
  return { status: r.status, json: await r.json() };
}

// T5 05/11 · T6 06/11 · T7 07/11 · CN 08/11 · T2 09/11
async function main() {
  console.log('0. Hàm thuần');
  eq(carryLabel('2026-11-05'), 'Tự động từ 05/11', 'nhãn tự chép');
  ok(isCarryName('Tự động từ 05/11') && !isCarryName('KHSX tự động') && !isCarryName(null), 'nhận diện nhãn');
  ok(isSundayISO('2026-11-08') && !isSundayISO('2026-11-07') && !isSundayISO('2026-11-09'), 'Chủ nhật 08/11');
  eq(addDaysISO('2026-11-01', -10), '2026-10-22', 'lùi 10 ngày qua tháng');
  eq(addDaysISO('2026-12-31', 1), '2027-01-01', 'qua năm');
  eq(isoVN(Date.parse('2026-11-06T16:59:00Z')), '2026-11-06', '23:59 VN vẫn là 06/11');
  eq(isoVN(Date.parse('2026-11-06T17:00:00Z')), '2026-11-07', '00:00 VN sang 07/11');
  const vn = (t: string) => Date.parse(`${t}:00Z`) - 7 * 3600 * 1000;
  ok(!remindDue(vn('2026-11-07T15:29')), '15:29 chưa nhắc');
  ok(remindDue(vn('2026-11-07T15:30')), '15:30 nhắc');
  ok(remindDue(vn('2026-11-07T23:59')), '23:59 vẫn nhắc');
  ok(!remindDue(vn('2026-11-07T00:10')), '00:10 không nhắc');
  ok(!remindDue(vn('2026-11-08T16:00')), 'Chủ nhật không nhắc');

  console.log('1. Chưa có dữ liệu RL nào → không chép gì');
  nap(); datPhien(RL); datGio('2026-11-07T08:00');
  let r = await get();
  eq(r.status, 200, 'GET 200');
  eq(db.machine_stop_reasons.length, 0, 'không thêm dòng');

  console.log('2. Ngày nguồn = hôm qua: chép máy RL đang dừng, bỏ máy đã bỏ, không đụng HD/máy ảo');
  nap();
  them({ stop_date: '2026-11-06', machine_code: 'RL-02', reason_code: 'MT', reason_text: 'Hư bơm' });
  them({ stop_date: '2026-11-06', machine_code: 'RL-24', reason_code: 'NP' });
  them({ stop_date: '2026-11-06', machine_code: 'SM-06', reason_code: 'NW', dismissed: true });
  them({ stop_date: '2026-11-06', machine_code: 'CT-01', reason_code: 'ETC', reason_text: 'Chờ dao' });
  them({ stop_date: '2026-11-06', machine_code: 'HD-01', reason_code: 'NM' });
  them({ stop_date: '2026-11-06', machine_code: 'CVK-RL', reason_code: 'NW' });    // máy ảo (dữ liệu bẩn)
  them({ stop_date: '2026-11-05', machine_code: 'SM-2A', reason_code: 'NR' });     // ngày cũ hơn — KHÔNG lấy
  datPhien(RL); datGio('2026-11-07T07:30');
  r = await get();
  eq(tom('2026-11-07'), [
    'CT-01:ETC/Chờ dao:dừng:Tự động từ 06/11',
    'RL-02:MT/Hư bơm:dừng:Tự động từ 06/11',
    'RL-24:NP:dừng:Tự động từ 06/11',
  ], 'chép đúng 3 máy');
  ok(dong('2026-11-07').every((x) => x.department === 'RL' && x.created_by === null), 'bộ phận RL, created_by null');
  eq(r.json.reasons.map((x: Row) => x.machine_code), ['CT-01', 'RL-02', 'RL-24'], 'GET trả luôn dòng vừa chép');
  eq(tom('2026-11-06').length, 6, 'ngày nguồn không bị đổi');

  console.log('3. Mở lại nhiều lần → không trùng, không đè');
  const n0 = db.machine_stop_reasons.length;
  await get(); await get('2026-11-07', true);
  eq(db.machine_stop_reasons.length, n0, 'không thêm dòng');

  console.log('4. Tổ trưởng bỏ máy chạy lại → mở lại không tái sinh');
  r = await post({ date: '2026-11-07', machine_code: 'RL-24', reason_code: null });
  eq(r.status, 200, 'bỏ được');
  await get();
  eq(tom('2026-11-07').find((x) => x.startsWith('RL-24')), 'RL-24:NP:BỎ:Tự động từ 06/11', 'RL-24 vẫn BỎ');
  eq((await get()).json.reasons.map((x: Row) => x.machine_code), ['CT-01', 'RL-02'], 'danh sách hiện 2 máy');

  console.log('5. Tổ trưởng ghi trước khi chép → giữ bản tổ trưởng');
  nap();
  them({ stop_date: '2026-11-06', machine_code: 'RL-02', reason_code: 'MT' });
  them({ stop_date: '2026-11-06', machine_code: 'SM-06', reason_code: 'NW' });
  them({ stop_date: '2026-11-07', machine_code: 'RL-02', reason_code: 'NR', created_by_name: 'Tổ trưởng RL' });
  datPhien(RL); datGio('2026-11-07T10:00');
  await get();
  eq(tom('2026-11-07'), ['RL-02:NR:dừng:Tổ trưởng RL', 'SM-06:NW:dừng:Tự động từ 06/11'], 'không đè RL-02');

  console.log('6. Chủ nhật không chép; thứ Hai chép từ thứ Bảy');
  nap();
  them({ stop_date: '2026-11-07', machine_code: 'RL-02', reason_code: 'MT' });
  datPhien(RL); datGio('2026-11-08T09:00');
  await get();
  eq(dong('2026-11-08').length, 0, 'CN không chép');
  datGio('2026-11-09T07:00');
  await get();
  eq(tom('2026-11-09'), ['RL-02:MT:dừng:Tự động từ 07/11'], 'T2 lấy từ T7');

  console.log('7. Ngày nguồn bỏ hết → không lôi máy dừng cũ hơn sống lại');
  nap();
  them({ stop_date: '2026-11-05', machine_code: 'RL-02', reason_code: 'MT' });
  them({ stop_date: '2026-11-06', machine_code: 'RL-02', reason_code: 'MT', dismissed: true });
  datPhien(RL); datGio('2026-11-07T07:00');
  await get();
  eq(dong('2026-11-07').length, 0, 'không chép');

  console.log('8. Quá 10 ngày → không chép; đúng 10 ngày → chép');
  nap();
  them({ stop_date: '2026-10-27', machine_code: 'RL-02', reason_code: 'MT' });
  datPhien(RL); datGio('2026-11-07T07:00');
  await get();
  eq(dong('2026-11-07').length, 0, '11 ngày trước: không');
  nap();
  them({ stop_date: '2026-10-28', machine_code: 'RL-02', reason_code: 'MT' });
  await get();
  eq(tom('2026-11-07'), ['RL-02:MT:dừng:Tự động từ 28/10'], '10 ngày trước: có');

  console.log('9. Xem ngày cũ / HD leader / admin');
  nap();
  them({ stop_date: '2026-11-06', machine_code: 'RL-02', reason_code: 'MT' });
  datPhien(RL); datGio('2026-11-07T07:00');
  await get('2026-11-06');
  eq(dong('2026-11-07').length, 0, 'xem ngày 06/11 không chép sang 07/11');
  datPhien(HDL);
  r = await get();
  eq(tom('2026-11-07'), ['RL-02:MT:dừng:Tự động từ 06/11'], 'tổ trưởng HD mở cũng chép (RL)');
  eq(r.json.machines.map((m: { code: string }) => m.code), ['HD-01', 'HD-02'], 'HD leader vẫn chỉ thấy máy HD');
  nap();
  them({ stop_date: '2026-11-06', machine_code: 'RL-02', reason_code: 'MT' });
  datPhien(ADMIN);
  await get(undefined, true);       // app chính 09:00 (all=1)
  eq(tom('2026-11-07'), ['RL-02:MT:dừng:Tự động từ 06/11'], 'app chính (admin all=1) cũng kích chép');

  console.log('10. Chuỗi nhiều ngày: hôm sau chép tiếp từ dòng tự chép');
  datGio('2026-11-09T07:00');
  await get();
  eq(tom('2026-11-09'), ['RL-02:MT:dừng:Tự động từ 07/11'], 'T2 chép từ dòng tự chép T7');

  console.log('11. Sửa ngày nguồn sau khi đã chép → dòng tự chép hôm nay đi theo');
  nap();
  them({ stop_date: '2026-11-06', machine_code: 'RL-02', reason_code: 'MT' });
  them({ stop_date: '2026-11-06', machine_code: 'RL-24', reason_code: 'NP' });
  them({ stop_date: '2026-11-06', machine_code: 'SM-06', reason_code: 'NW' });
  datPhien(RL); datGio('2026-11-07T07:00');
  await get();
  eq(dong('2026-11-07').length, 3, 'đã chép 3');
  // tổ trưởng tự sửa SM-06 hôm nay → bản tổ trưởng
  await post({ date: '2026-11-07', machine_code: 'SM-06', reason_code: 'NR' });
  // sáng nay sửa danh sách hôm qua
  r = await post({ date: '2026-11-06', machine_code: 'RL-02', reason_code: null });          // máy chạy
  eq(r.status, 200, 'bỏ hôm qua được');
  r = await post({ date: '2026-11-06', machine_code: 'RL-24', reason_code: 'ETC', reason_text: 'Chờ khuôn' });
  eq(r.status, 200, 'đổi lý do hôm qua được');
  r = await post({ date: '2026-11-06', machine_code: 'SM-06', reason_code: null });          // đã bị tổ trưởng sửa hôm nay
  r = await post({ date: '2026-11-06', machine_code: 'CT-01', reason_code: 'MT' });          // máy mới thêm vào hôm qua
  eq(tom('2026-11-07'), [
    'RL-02:MT:BỎ:Tự động từ 06/11',
    'RL-24:ETC/Chờ khuôn:dừng:Tự động từ 06/11',
    'SM-06:NR:dừng:Tổ trưởng RL',
  ], 'RL-02 bỏ theo · RL-24 đổi theo · SM-06 bản tổ trưởng giữ nguyên');
  await get();
  eq(tom('2026-11-07').find((x) => x.startsWith('CT-01')), 'CT-01:MT:dừng:Tự động từ 06/11', 'máy thêm vào hôm qua → lần mở sau chép sang');
  eq(tom('2026-11-07').find((x) => x.startsWith('RL-02')), 'RL-02:MT:BỎ:Tự động từ 06/11', 'RL-02 không tái sinh');

  console.log('12. Sửa hôm nay KHÔNG kéo theo gì; HD không bị đi theo');
  nap();
  them({ stop_date: '2026-11-06', machine_code: 'HD-01', reason_code: 'NM' });
  them({ stop_date: '2026-11-07', machine_code: 'HD-01', reason_code: 'NM', created_by: null, created_by_name: 'KHSX tự động' });
  datPhien(HDL); datGio('2026-11-07T08:00');
  await post({ date: '2026-11-06', machine_code: 'HD-01', reason_code: null });
  eq(tom('2026-11-07'), ['HD-01:NM:dừng:KHSX tự động'], 'dòng KHSX tự động hôm nay không đổi');
  ok(!nhatKy.some((x) => x.op === 'upsert' && x.rows.some((y: Row) => y.machine_code.startsWith('HD') && isCarryName(y.created_by_name))),
    'không bao giờ chép HD');

  console.log('13. Dữ liệu ghi: chỉ upsert DO NOTHING khi chép');
  nap();
  them({ stop_date: '2026-11-06', machine_code: 'RL-02', reason_code: 'MT' });
  datPhien(RL); datGio('2026-11-07T07:00');
  await get();
  const ghi = nhatKy.filter((x) => x.op !== 'select');
  eq(ghi.map((x) => `${x.op}:${x.table}`), ['upsert:machine_stop_reasons'], 'đúng 1 lệnh ghi');

  Date.now = goc;
  console.log(`\nKẾT QUẢ: ${pass} đạt · ${fail} lỗi`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
