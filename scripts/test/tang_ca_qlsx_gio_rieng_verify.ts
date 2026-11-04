// BÀI KIỂM — TĂNG CA QLSX: chọn 3h / 4h / Khác từng người ca chiều (anh Hữu 04/11/2026:
// "Tăng ca QLSX cũng áp dụng tương tự như các bộ phận khác").
//
// Chạy ĐÚNG code thật: route POST /api/registrations/qlsx, phiếu in (OvertimeSheetArticle), đồng bộ app chính
// (/api/overtime-export) — trên SUPABASE GIẢ trong bộ nhớ (_gia_lap/), KHÔNG ghi Supabase thật, không gọi mạng.
//   npx tsx --require ./scripts/test/_gia_lap/dang-ky.cjs scripts/test/tang_ca_qlsx_gio_rieng_verify.ts
import { renderToStaticMarkup } from 'react-dom/server';
import { db, datLai, nhatKy } from './_gia_lap/supabase-gia.mjs';
import { datPhien } from './_gia_lap/auth-gia.mjs';
import { POST } from '../../app/api/registrations/qlsx/route';
import { GET as EXPORT } from '../../app/api/overtime-export/route';
import OvertimeSheetArticle from '../../components/OvertimeSheetArticle';

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

const NGAY = '2026-11-05';   // thứ Năm
const CN = '2026-11-08';
const ADMIN = { userId: 'u-admin', role: 'admin', department: null, username: 'ad', fullName: 'Admin' };
const LEADER = { userId: 'u-leader', role: 'leader', department: 'HD', username: 'tt', fullName: 'Tổ trưởng' };

function nap() {
  datLai();
  db.users.push({ id: 'u-admin', full_name: 'Admin' });
  db.employees.push(
    { id: 'Q1', full_name: 'NGUYỄN VĂN MỘT', department: 'QLSX', order_no: 1, active: true },
    { id: 'Q2', full_name: 'TRẦN VĂN HAI', department: 'QLSX', order_no: 2, active: true },
    { id: 'Q3', full_name: 'LÊ VĂN BA', department: 'QLSX', order_no: 3, active: true },
  );
  db.equipments.push({ id: 'CVKQ', code: 'CVK-QLSX', department: 'QLSX', spec: 'Công việc QLSX', machine_type: 'OTHER', rpm: 0 });
}

async function post(body: unknown) {
  const r = await POST(new Request('http://x/api', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }));
  return { status: r.status, json: await r.json() };
}
const itemsOf = (regId: string) => db.overtime_items.filter((i: { registration_id: string }) => i.registration_id === regId);
const gioCua = (regId: string, emp: string) =>
  itemsOf(regId).filter((i: { employee_id: string }) => i.employee_id === emp)
    .map((i: { time_from: string | null; time_to: string | null; duration_hours: number | null }) =>
      `${i.time_from}-${i.time_to}/${i.duration_hours}`);
const regOf = (id: string) => db.overtime_registrations.find((r: { id: string }) => r.id === id)!;

async function phieuIn(regId: string) {
  const html = renderToStaticMarkup(await OvertimeSheetArticle({ regId }));
  const out: string[][] = [];
  const re = /<td[^>]*rowSpan="\d+"[^>]*>([^<]*)<\/td><td[^>]*rowSpan="\d+"[^>]*>([^<]*)<\/td><td[^>]*rowSpan="\d+"[^>]*>([^<]*)<\/td><td[^>]*rowSpan="\d+"[^>]*>([^<]*)<\/td>/gi;
  for (const m of html.matchAll(re)) out.push([m[2], m[3], m[4]]);
  return out;
}
async function exportApp() {
  process.env.AGENT_SECRET = 'bi-mat-gia';
  const r = await EXPORT(new Request('http://x/api/overtime-export', { headers: { authorization: 'Bearer bi-mat-gia' } }));
  return r.json();
}

async function main() {
  console.log('1. Admin gửi phiếu QLSX ca chiều: 3h, 4h, Khác 2,5h');
  nap(); datPhien(ADMIN);
  const r1 = await post({
    overtime_date: NGAY, day_type: 'weekday', shift: 'PM',
    items: [
      { employee_id: 'Q1', reason: 'Lập kế hoạch', duration_hours: 3 },
      { employee_id: 'Q2', reason: 'Họp khách', duration_hours: 4 },
      { employee_id: 'Q3', reason: 'Kiểm kê', duration_hours: 2.5 },
    ],
  });
  eq(r1.status, 200, 'gửi được');
  const id1 = r1.json.id as string;
  const h1 = regOf(id1);
  eq([h1.department, h1.time_from, h1.time_to, h1.duration_hours, h1.shift],
    ['QLSX', '16:30:00', '20:30:00', 4, 'PM'], 'đầu phiếu = muộn nhất 20:30, 4h');
  eq(gioCua(id1, 'Q1'), ['16:30:00-19:30:00/3'], 'Q1 3h');
  eq(gioCua(id1, 'Q2'), ['16:30:00-20:30:00/4'], 'Q2 4h');
  eq(gioCua(id1, 'Q3'), ['16:30:00-19:00:00/2.5'], 'Q3 Khác 2,5h');
  eq(itemsOf(id1).map((i: { item_code: string }) => i.item_code), ['Lập kế hoạch', 'Họp khách', 'Kiểm kê'], 'lý do giữ nguyên');
  ok(nhatKy.every((n) => ['overtime_registrations', 'overtime_items'].includes(n.table)), 'chỉ ghi 2 bảng như cũ');

  console.log('2. Phiếu in + đồng bộ app chính');
  eq(await phieuIn(id1), [
    ['Nguyễn Văn Một', '16h30-19h30', '3'],
    ['Trần Văn Hai', '16h30-20h30', '4'],
    ['Lê Văn Ba', '16h30-19h00', '2.5'],
  ], 'phiếu in đúng giờ từng người');
  const ex = await exportApp();
  eq(ex.rows.map((r: { employee_id: string; hours: number }) => [r.employee_id, r.hours]),
    [['Q1', 3], ['Q2', 4], ['Q3', 2.5]], 'giờ sang app chính từng người');

  console.log('3. Phiếu không gửi số giờ (form cũ) — y như trước');
  nap(); datPhien(ADMIN);
  const r3 = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM', items: [{ employee_id: 'Q1', reason: 'X' }] });
  eq(r3.status, 200, 'gửi được');
  eq([regOf(r3.json.id).time_from, regOf(r3.json.id).time_to, regOf(r3.json.id).duration_hours],
    ['16:30:00', '19:30:00', 3], 'đầu phiếu 16:30–19:30, 3h');
  eq(gioCua(r3.json.id, 'Q1'), ['null-null/null'], 'dòng không ghi giờ riêng (như cũ)');

  console.log('4. Ca sáng / Chủ nhật: bỏ qua số giờ gửi lên');
  nap(); datPhien(ADMIN);
  const r4 = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'AM', items: [{ employee_id: 'Q1', reason: 'X', duration_hours: 4 }] });
  eq([r4.status, regOf(r4.json.id).time_from, regOf(r4.json.id).time_to, regOf(r4.json.id).duration_hours],
    [200, '06:00:00', '07:30:00', 1.5], 'AM giữ 06:00–07:30');
  eq(gioCua(r4.json.id, 'Q1'), ['null-null/null'], 'AM: dòng không ghi giờ riêng');
  const r4b = await post({ overtime_date: CN, day_type: 'sunday', items: [{ employee_id: 'Q1', reason: 'X', duration_hours: 4 }] });
  eq([r4b.status, regOf(r4b.json.id).duration_hours], [200, 8], 'Chủ nhật giữ 8h');

  console.log('5. Kiểm lỗi — không ghi gì');
  nap(); datPhien(ADMIN);
  const n0 = nhatKy.length;
  const r5 = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM', items: [{ employee_id: 'Q1', reason: 'X', duration_hours: 7.5 }] });
  eq([r5.status, r5.json.error], [400, 'Số giờ tăng ca không hợp lệ (từ 0,5 đến 7 giờ, bước 0,5 giờ)'], 'giờ 7,5 bị chặn');
  const r5b = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM', items: [
    { employee_id: 'Q1', reason: 'X', duration_hours: 3 }, { employee_id: 'Q1', reason: 'Y', duration_hours: 4 }] });
  eq([r5b.status, r5b.json.error], [400, 'Một nhân viên có 2 số giờ khác nhau trong cùng phiếu'], 'một người 2 số giờ bị chặn');
  eq(nhatKy.length, n0, 'không ghi gì');

  console.log('6. Trùng ca / quyền');
  nap(); datPhien(ADMIN);
  await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM', items: [{ employee_id: 'Q1', reason: 'X', duration_hours: 4 }] });
  const r6 = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM', items: [{ employee_id: 'Q2', reason: 'X', duration_hours: 3 }] });
  eq(r6.status, 409, 'phiếu PM thứ hai cùng ngày bị chặn');
  ok(String(r6.json.error).includes('bộ phận QLSX đã có phiếu PM'), 'báo đúng bộ phận QLSX');
  const r6b = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'AM', items: [{ employee_id: 'Q1', reason: 'X' }] });
  eq(r6b.status, 200, 'Q1 4h chiều + ca sáng 06:00–07:30 không chồng giờ → gửi được');
  datPhien(LEADER);
  const r6c = await post({ overtime_date: CN, day_type: 'sunday', items: [{ employee_id: 'Q1', reason: 'X' }] });
  eq(r6c.status, 403, 'tổ trưởng không gửi phiếu QLSX được');

  console.log(`\nKẾT QUẢ: ${pass} đạt · ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
