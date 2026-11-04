// BÀI KIỂM — GIỜ TĂNG CA CHIỀU RIÊNG TỪNG NGƯỜI: 3h / 4h / Khác (anh Hữu 04/11/2026).
//
// Chạy ĐÚNG code thật: route POST/PATCH phiếu, phiếu in (OvertimeSheetArticle), route đồng bộ
// sang app chính (/api/overtime-export) — nhưng trên SUPABASE GIẢ trong bộ nhớ (_gia_lap/),
// KHÔNG ghi gì lên Supabase thật, không gọi mạng.
//   npx tsx --require ./scripts/test/_gia_lap/dang-ky.cjs scripts/test/gio_rieng_tung_nguoi_verify.ts
import { renderToStaticMarkup } from 'react-dom/server';
import { db, datLai, nhatKy } from './_gia_lap/supabase-gia.mjs';
import { datPhien } from './_gia_lap/auth-gia.mjs';
import { POST } from '../../app/api/registrations/route';
import { PATCH } from '../../app/api/registrations/[id]/route';
import { GET as EXPORT } from '../../app/api/overtime-export/route';
import OvertimeSheetArticle from '../../components/OvertimeSheetArticle';
import {
  hasPerPersonHours, isValidPmHours, parseHoursInput, pmPresetFor, qtyHoursOf,
} from '../../lib/overtime-shift';
import { choiceFromHours, hoursOf } from '../../components/HoursPicker';

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
const LEADER = { userId: 'u-leader', role: 'leader', department: 'HD', username: 'tt', fullName: 'Tổ trưởng' };
const ADMIN = { userId: 'u-admin', role: 'admin', department: null, username: 'ad', fullName: 'Admin' };

function nap() {
  datLai();
  db.users.push({ id: 'u-leader', full_name: 'Tổ Trưởng HD' });
  db.employees.push(
    { id: 'E1', full_name: 'NGUYỄN VĂN MỘT', department: 'HD', order_no: 1, active: true },
    { id: 'E2', full_name: 'TRẦN VĂN HAI', department: 'HD', order_no: 2, active: true },
    { id: 'E3', full_name: 'LÊ VĂN BA', department: 'HD', order_no: 3, active: true },
    { id: 'E4', full_name: 'PHẠM VĂN BỐN', department: 'HD', order_no: 4, active: true },
  );
  db.equipments.push(
    { id: 'M1', code: 'HD-01', department: 'HD', spec: '', machine_type: 'HD', rpm: 100 },
    { id: 'M2', code: 'HD-02', department: 'HD', spec: '', machine_type: 'HD', rpm: 120 },
    { id: 'M3', code: 'HD-03', department: 'HD', spec: '', machine_type: 'HD', rpm: 80 },
    { id: 'M20', code: 'HD-20', department: 'HD', spec: '', machine_type: 'HD', rpm: 50 },
  );
}

const req = (body: unknown) =>
  new Request('http://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
async function post(body: unknown) {
  const r = await POST(req(body));
  return { status: r.status, json: await r.json() };
}
async function patch(id: string, body: unknown) {
  const r = await PATCH(req(body), { params: Promise.resolve({ id }) });
  return { status: r.status, json: await r.json() };
}
const itemsOf = (regId: string) => db.overtime_items.filter((i: { registration_id: string }) => i.registration_id === regId);
const gioCua = (regId: string, emp: string) =>
  itemsOf(regId).filter((i: { employee_id: string }) => i.employee_id === emp)
    .map((i: { time_from: string | null; time_to: string | null; duration_hours: number | null }) =>
      `${i.time_from}-${i.time_to}/${i.duration_hours}`);
const regOf = (id: string) => db.overtime_registrations.find((r: { id: string }) => r.id === id)!;

// Phiếu in → [tên, khung giờ, số giờ] từng người (dòng có rowSpan)
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
  // ---------------------------------------------------------------- 1. Hàm thư viện
  console.log('1. Hàm thư viện');
  eq(['0.5', '2.5', '3', '3.5', '4', '7'].map((h) => pmPresetFor(Number(h)).time_to),
    ['17:00:00', '19:00:00', '19:30:00', '20:00:00', '20:30:00', '23:30:00'], 'giờ kết thúc = 16:30 + số giờ');
  eq(pmPresetFor(4).time_from, '16:30:00', 'bắt đầu luôn 16:30');
  eq([0.5, 1, 3, 3.5, 7].map(isValidPmHours), [true, true, true, true, true], 'số giờ hợp lệ');
  eq([0, 0.25, 3.25, 7.5, 8, -1, NaN, '3' as unknown].map(isValidPmHours),
    [false, false, false, false, false, false, false, false], 'số giờ không hợp lệ');
  eq(['3,5', '3.5', ' 4 ', 'abc', '', '3,5h'].map(parseHoursInput), [3.5, 3.5, 4, null, null, null], 'đọc ô Khác');
  eq([hasPerPersonHours('weekday', 'PM'), hasPerPersonHours('weekday', 'AM'), hasPerPersonHours('sunday', 'PM'),
    hasPerPersonHours('weekday', undefined)], [true, false, false, true], 'chỉ ca chiều ngày thường');
  eq([qtyHoursOf(3, 'PM'), qtyHoursOf(4, 'PM'), qtyHoursOf(2.5, 'PM')], [2.5, 3.5, 2], 'giờ tính SL trừ 0,5h nghỉ');
  eq([hoursOf({ choice: 3, otherText: '' }), hoursOf({ choice: 4, otherText: '9' }),
    hoursOf({ choice: 'other', otherText: '2,5' }), hoursOf({ choice: 'other', otherText: '7,5' }),
    hoursOf({ choice: 'other', otherText: '' })], [3, 4, 2.5, null, null], 'ô chọn giờ → số giờ');
  eq([choiceFromHours(3), choiceFromHours(4), choiceFromHours(2.5)],
    [{ choice: 3, otherText: '' }, { choice: 4, otherText: '' }, { choice: 'other', otherText: '2,5' }], 'giờ đã lưu → nút');

  // ---------------------------------------------------------------- 2. Gửi phiếu PM lẫn 3h / 4h / Khác
  console.log('2. Tổ trưởng gửi phiếu ca chiều: 3h, 4h, Khác 2,5h');
  nap(); datPhien(LEADER);
  const r2 = await post({
    overtime_date: NGAY, day_type: 'weekday', shift: 'PM',
    items: [
      { employee_id: 'E1', duration_hours: 3, equipment_id: 'M1', item_code: 'A1', planned_quantity: 15000 },
      { employee_id: 'E2', duration_hours: 4, equipment_id: 'M2', item_code: 'A2', planned_quantity: 25200 },
      { employee_id: 'E2', duration_hours: 4, equipment_id: 'M20', item_code: 'A20', planned_quantity: 10500 },
      { employee_id: 'E3', duration_hours: 2.5, is_other: true, other_description: 'Vệ sinh máy' },
    ],
  });
  eq(r2.status, 200, 'gửi được phiếu');
  const id2 = r2.json.id as string;
  const h2 = regOf(id2);
  eq([h2.time_from, h2.time_to, h2.duration_hours, h2.shift], ['16:30:00', '20:30:00', 4, 'PM'], 'đầu phiếu = muộn nhất 20:30, 4h');
  eq(gioCua(id2, 'E1'), ['16:30:00-19:30:00/3'], 'E1 3h');
  eq(gioCua(id2, 'E2'), ['16:30:00-20:30:00/4', '16:30:00-20:30:00/4'], 'E2 4h cả 2 máy');
  eq(gioCua(id2, 'E3'), ['16:30:00-19:00:00/2.5'], 'E3 Khác 2,5h');
  ok(nhatKy.every((n) => ['overtime_registrations', 'overtime_items', 'equipments'].includes(n.table)), 'chỉ ghi 3 bảng như cũ');

  console.log('3. Phiếu in');
  eq(await phieuIn(id2), [
    ['Nguyễn Văn Một', '16h30-19h30', '3'],
    ['Trần Văn Hai', '16h30-20h30', '4'],
    ['Lê Văn Ba', '16h30-19h00', '2.5'],
  ], 'phiếu in đúng giờ từng người');

  console.log('4. Đồng bộ sang app chính (/api/overtime-export)');
  const ex = await exportApp();
  eq(ex.rows.map((r: { employee_id: string; hours: number; day_type: string }) => [r.employee_id, r.hours, r.day_type]),
    [['E1', 3, 'weekday'], ['E2', 4, 'weekday'], ['E3', 2.5, 'weekday']], 'giờ tính công từng người (không cộng dồn 2 máy của E2)');
  eq(ex.details.map((d: { employee_id: string; machine: string; time_from: string; time_to: string; hours: number }) =>
    [d.employee_id, d.machine, d.time_from, d.time_to, d.hours]).sort(), [
    ['E1', 'HD-01', '16:30', '19:30', 3], ['E2', 'HD-02', '16:30', '20:30', 4],
    ['E2', 'HD-20', '16:30', '20:30', 4], ['E3', 'CVK-HD', '16:30', '19:00', 2.5],
  ], 'chi tiết từng dòng sang app chính');

  // ---------------------------------------------------------------- 5. Phiếu kiểu cũ (không gửi giờ) = y như trước
  console.log('5. Phiếu không gửi số giờ (bản cũ / app cũ trong máy) — y như trước');
  nap(); datPhien(LEADER);
  const r5 = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM',
    items: [{ employee_id: 'E1', equipment_id: 'M1', item_code: 'A1', planned_quantity: 15000 }] });
  const h5 = regOf(r5.json.id);
  eq([h5.time_from, h5.time_to, h5.duration_hours], ['16:30:00', '19:30:00', 3], 'đầu phiếu 3h');
  eq(gioCua(r5.json.id, 'E1'), ['null-null/null'], 'dòng để trống giờ như cũ');
  eq(await phieuIn(r5.json.id), [['Nguyễn Văn Một', '16h30-19h30', '3']], 'phiếu in 3h');

  // ---------------------------------------------------------------- 6. Ca sáng / Chủ nhật: bỏ qua số giờ gửi lên
  console.log('6. Ca sáng & Chủ nhật giữ giờ cố định');
  nap(); datPhien(LEADER);
  const r6a = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'AM',
    items: [{ employee_id: 'E1', duration_hours: 4, equipment_id: 'M1', item_code: 'A1' }] });
  eq([regOf(r6a.json.id).time_from, regOf(r6a.json.id).time_to, regOf(r6a.json.id).duration_hours],
    ['06:00:00', '07:30:00', 1.5], 'AM 06:00–07:30');
  eq(gioCua(r6a.json.id, 'E1'), ['null-null/null'], 'AM không ghi giờ riêng');
  const r6b = await post({ overtime_date: CN, day_type: 'sunday', shift: 'PM',
    items: [{ employee_id: 'E1', duration_hours: 4, equipment_id: 'M1', item_code: 'A1' }] });
  eq([regOf(r6b.json.id).time_from, regOf(r6b.json.id).time_to, regOf(r6b.json.id).duration_hours],
    ['06:00:00', '14:00:00', 8], 'Chủ nhật 8h');
  eq(gioCua(r6b.json.id, 'E1'), ['null-null/null'], 'Chủ nhật không ghi giờ riêng');
  // Cùng ngày: AM 1,5h + PM 4h = 5,5h
  await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM',
    items: [{ employee_id: 'E1', duration_hours: 4, equipment_id: 'M1', item_code: 'A1' }] });
  const ex6 = await exportApp();
  eq(ex6.rows.filter((r: { date: string }) => r.date === NGAY).map((r: { hours: number }) => r.hours), [5.5], 'AM 1,5h + PM 4h = 5,5h');

  // ---------------------------------------------------------------- 7. Chặn số giờ sai
  console.log('7. Máy chủ chặn số giờ sai');
  nap(); datPhien(LEADER);
  for (const bad of [0, 3.25, 7.5, 8, -1, '4']) {
    const r = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM',
      items: [{ employee_id: 'E1', duration_hours: bad, equipment_id: 'M1', item_code: 'A1' }] });
    eq(r.status, 400, `chặn ${JSON.stringify(bad)}`);
  }
  const r7 = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM', items: [
    { employee_id: 'E1', duration_hours: 3, equipment_id: 'M1', item_code: 'A1' },
    { employee_id: 'E1', duration_hours: 4, equipment_id: 'M2', item_code: 'A2' }] });
  eq(r7.status, 400, 'chặn 1 người 2 số giờ');
  eq(db.overtime_registrations.length, 0, 'không phiếu nào được tạo khi bị chặn');

  // ---------------------------------------------------------------- 8. Chồng giờ với phiếu khác cùng ngày
  console.log('8. Kiểm chồng giờ theo giờ riêng');
  nap(); datPhien(LEADER);
  db.overtime_registrations.push({ id: 'R-KHAC', department: 'QLSX', registered_by: null, overtime_date: NGAY,
    day_type: 'weekday', shift: 'PM', time_from: '19:00:00', time_to: '21:00:00', duration_hours: 2, status: 'pending' });
  db.overtime_items.push({ id: 'I-KHAC', registration_id: 'R-KHAC', employee_id: 'E1', equipment_id: 'M1', item_code: 'X',
    item_name: null, planned_quantity: null, actual_quantity: null, note: null, time_from: null, time_to: null, duration_hours: null });
  const r8a = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM',
    items: [{ employee_id: 'E1', duration_hours: 4, equipment_id: 'M1', item_code: 'A1' }] });
  eq(r8a.status, 409, '4h (đến 20:30) chồng 19:00–21:00 → chặn');
  const r8b = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM',
    items: [{ employee_id: 'E1', duration_hours: 2.5, equipment_id: 'M1', item_code: 'A1' }] });
  eq(r8b.status, 200, '2,5h (đến 19:00) chạm mép → cho');

  // ---------------------------------------------------------------- 9. Tổ trưởng SỬA phiếu
  console.log('9. Tổ trưởng sửa phiếu');
  nap(); datPhien(LEADER);
  const base = await post({ overtime_date: NGAY, day_type: 'weekday', shift: 'PM', items: [
    { employee_id: 'E1', duration_hours: 3, equipment_id: 'M1', item_code: 'A1' },
    { employee_id: 'E2', duration_hours: 4, equipment_id: 'M2', item_code: 'A2' },
    { employee_id: 'E3', duration_hours: 2.5, is_other: true, other_description: 'Vệ sinh' }] });
  const id9 = base.json.id as string;
  // Admin sửa tay giờ E3 thành 17:00–19:30 (để kiểm tổ trưởng không đè mất)
  datPhien(ADMIN);
  const cur = () => itemsOf(id9).map((i: { id: string; employee_id: string; equipment_id: string; item_code: string; item_name: string | null }) => ({
    id: i.id, employee_id: i.employee_id, equipment_id: i.equipment_id, item_code: i.item_code, item_name: i.item_name }));
  const adm = cur().map((i: { employee_id: string }) => i.employee_id === 'E3'
    ? { ...i, time_from: '17:00', time_to: '19:30' }
    : { ...i, time_from: i.employee_id === 'E1' ? '16:30' : '16:30', time_to: i.employee_id === 'E1' ? '19:30' : '20:30' });
  eq((await patch(id9, { items: adm })).status, 200, 'admin sửa giờ E3');
  eq(gioCua(id9, 'E3'), ['17:00:00-19:30:00/2.5'], 'E3 17:00–19:30 (admin)');

  datPhien(LEADER);
  const truoc = JSON.stringify(itemsOf(id9));
  eq((await patch(id9, { items: cur() })).status, 200, 'lưu lại không đổi gì');
  eq(JSON.stringify(itemsOf(id9)), truoc, 'lưu không đổi → mọi dòng giữ nguyên (cả giờ admin 17:00)');

  // E1 đổi 3h → 4h
  const doiE1 = cur().map((i: { employee_id: string }) => (i.employee_id === 'E1' ? { ...i, duration_hours: 4 } : i));
  eq((await patch(id9, { items: doiE1 })).status, 200, 'E1 đổi sang 4h');
  eq(gioCua(id9, 'E1'), ['16:30:00-20:30:00/4'], 'E1 16:30–20:30');
  eq(itemsOf(id9).find((i: { employee_id: string }) => i.employee_id === 'E1')!.planned_quantity, 100 * 60 * 3.5, 'E1 SL dự kiến theo 3,5h');
  eq(gioCua(id9, 'E2'), ['16:30:00-20:30:00/4'], 'E2 không đổi');
  eq(gioCua(id9, 'E3'), ['17:00:00-19:30:00/2.5'], 'E3 giờ admin không bị đè');

  // E2 thêm máy, không bấm giờ → máy mới theo giờ cũ của E2 (4h), không rơi về 3h
  const themMay = [...cur(), { employee_id: 'E2', equipment_id: 'M3', item_code: 'A3', item_name: null }];
  eq((await patch(id9, { items: themMay })).status, 200, 'E2 thêm máy HD-03');
  eq(gioCua(id9, 'E2'), ['16:30:00-20:30:00/4', '16:30:00-20:30:00/4'], 'máy mới của E2 vẫn 4h');
  eq(itemsOf(id9).find((i: { equipment_id: string }) => i.equipment_id === 'M3')!.planned_quantity, 80 * 60 * 3.5, 'SL máy mới theo 3,5h');

  // Thêm người mới, không bấm giờ → 3h mặc định
  eq((await patch(id9, { items: [...cur(), { employee_id: 'E4', equipment_id: 'M20', item_code: 'B', item_name: null }] })).status, 200, 'thêm E4');
  eq(gioCua(id9, 'E4'), ['16:30:00-19:30:00/3'], 'người mới không chọn → 3h');

  // Tổ trưởng cố gửi giờ bắt đầu khác → bị bỏ qua
  const lach = cur().map((i: { employee_id: string }) => (i.employee_id === 'E4' ? { ...i, time_from: '15:00', time_to: '22:00' } : i));
  eq((await patch(id9, { items: lach })).status, 200, 'gửi kèm giờ bắt đầu lạ');
  eq(gioCua(id9, 'E4'), ['16:30:00-19:30:00/3'], 'giờ bắt đầu lạ của tổ trưởng bị bỏ qua');

  // Số giờ sai → chặn, dữ liệu không đổi
  const truoc2 = JSON.stringify(db);
  const sai = cur().map((i: { employee_id: string }) => (i.employee_id === 'E1' ? { ...i, duration_hours: 7.5 } : i));
  eq((await patch(id9, { items: sai })).status, 400, 'chặn 7,5h khi sửa');
  eq(JSON.stringify(db), truoc2, 'bị chặn → không ghi gì');

  const h9 = regOf(id9);
  eq([h9.time_from, h9.time_to, h9.duration_hours], ['16:30:00', '20:30:00', 4], 'đầu phiếu sau sửa');
  eq(await phieuIn(id9), [
    ['Nguyễn Văn Một', '16h30-20h30', '4'],
    ['Trần Văn Hai', '16h30-20h30', '4'],
    ['Phạm Văn Bốn', '16h30-19h30', '3'],
    ['Lê Văn Ba', '17h00-19h30', '2.5'],
  ], 'phiếu in sau sửa (người chỉ có Công việc khác xếp cuối như cũ)');
  const ex9 = await exportApp();
  // Xuất gói này cho bài kiểm phía app chính (đưa vào /api/ot/overtime-sync trên BẢN SAO hsb.db)
  if (process.env.XUAT_GOI_APP_CHINH) {
    (await import('node:fs')).writeFileSync(process.env.XUAT_GOI_APP_CHINH, JSON.stringify(ex9, null, 1));
  }
  eq(ex9.rows.map((r: { employee_id: string; hours: number }) => [r.employee_id, r.hours]),
    [['E1', 4], ['E2', 4], ['E3', 2.5], ['E4', 3]], 'app chính nhận giờ sau sửa');

  // Đổi sang ca sáng → giờ riêng bị bỏ, về 06:00–07:30
  const sangAM = cur().map((i: object) => ({ ...i, duration_hours: 4 }));
  eq((await patch(id9, { shift: 'AM', items: sangAM })).status, 200, 'đổi sang ca sáng');
  eq([...new Set(itemsOf(id9).map((i: { time_from: string; time_to: string; duration_hours: number }) =>
    `${i.time_from}-${i.time_to}/${i.duration_hours}`))], ['06:00:00-07:30:00/1.5'], 'mọi dòng 06:00–07:30');

  console.log(`\nKẾT QUẢ: ${pass} đạt · ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
