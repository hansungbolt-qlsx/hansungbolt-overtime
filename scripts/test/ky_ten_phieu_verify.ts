// BÀI KIỂM — CỘT CUỐI PHIẾU TĂNG CA "Ghi chú" → "Ký tên" (anh Hữu 16/11/2026).
//
// Công nhân tự ký xác nhận đồng ý tăng ca vào cột cuối mỗi ngày → 1 ô gộp MỖI NGƯỜI
// (người chạy nhiều máy vẫn ký 1 lần), ô để TRỐNG. Chữ "Tăng ca sáng" trước ghi vào
// cột này nay chuyển lên dòng Bộ phận. Áp dụng: phiếu in (OvertimeSheetArticle) +
// file Excel tải về (/api/export/[id]).
// Chạy code thật trên SUPABASE GIẢ (_gia_lap/), không ghi Supabase thật:
//   npx tsx --require ./scripts/test/_gia_lap/dang-ky.cjs scripts/test/ky_ten_phieu_verify.ts
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ExcelJS from 'exceljs';
import { renderToStaticMarkup } from 'react-dom/server';
import { db, datLai } from './_gia_lap/supabase-gia.mjs';
import { datPhien } from './_gia_lap/auth-gia.mjs';
import { POST } from '../../app/api/registrations/route';
import { GET as EXPORT_XLSX } from '../../app/api/export/[id]/route';
import OvertimeSheetArticle, { OT_PRINT_CSS } from '../../components/OvertimeSheetArticle';

let pass = 0;
let fail = 0;
function ok(cond: unknown, msg: string, ...x: unknown[]) {
  if (cond) pass++;
  else { fail++; console.log('  ✗ ' + msg, ...x); }
}

const NGAY = '2026-11-05';
const CN = '2026-11-08';
const LEADER = { userId: 'u-leader', role: 'leader', department: 'HD', username: 'tt', fullName: 'Tổ trưởng' };

function nap() {
  datLai();
  db.users.push({ id: 'u-leader', full_name: 'Tổ Trưởng HD' });
  db.employees.push(
    { id: 'E1', full_name: 'NGUYỄN VĂN MỘT', department: 'HD', order_no: 1, active: true },
    { id: 'E2', full_name: 'TRẦN VĂN HAI', department: 'HD', order_no: 2, active: true },
    { id: 'E3', full_name: 'LÊ VĂN BA', department: 'HD', order_no: 3, active: true },
  );
  db.equipments.push(
    { id: 'M1', code: 'HD-01', department: 'HD', spec: '', machine_type: 'HD', rpm: 100 },
    { id: 'M2', code: 'HD-02', department: 'HD', spec: '', machine_type: 'HD', rpm: 120 },
    { id: 'M3', code: 'HD-03', department: 'HD', spec: '', machine_type: 'HD', rpm: 80 },
  );
}

async function post(body: unknown) {
  const r = await POST(new Request('http://x/api', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }));
  return { status: r.status, json: await r.json() };
}

// Lưới cột: tính cả ô gộp từ dòng trên → mỗi dòng thân bảng phải đủ 12 cột.
function luoi(html: string) {
  const tbody = html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>'));
  const rows = [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map((c) => ({
      rs: Number(/rowSpan="(\d+)"/i.exec(c[1])?.[1] ?? 1),
      cs: Number(/colSpan="(\d+)"/i.exec(c[1])?.[1] ?? 1),
      txt: c[2].replace(/<[^>]+>/g, '').trim(),
    })));
  const loi: unknown[] = [];
  const oKy: { rs: number; txt: string }[] = [];
  let con: Record<number, number> = {};
  rows.forEach((cells, ri) => {
    let col = 0;
    for (const c of cells) {
      while ((con[col] ?? 0) > 0) col++;
      if (col === 11) oKy.push(c);
      for (let k = 0; k < c.cs; k++) con[col + k] = c.rs;
      col += c.cs;
    }
    while ((con[col] ?? 0) > 0) col++;
    if (col !== 12) loi.push({ ri, col });
    const n: Record<number, number> = {};
    for (const [k, v] of Object.entries(con)) if (v - 1 > 0) n[Number(k)] = v - 1;
    con = n;
  });
  return { loi, oKy };
}

async function phieu(regId: string) {
  return renderToStaticMarkup(await OvertimeSheetArticle({ regId }));
}

async function xlsx(regId: string) {
  const r = await EXPORT_XLSX(new Request('http://x'), { params: Promise.resolve({ id: regId }) });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await r.arrayBuffer()) as unknown as ExcelJS.Buffer);
  return { status: r.status, ws: wb.getWorksheet('HD')! };
}

async function main() {
  nap(); datPhien(LEADER);
  const out = path.join(os.tmpdir(), 'ky_ten_phieu');
  fs.mkdirSync(out, { recursive: true });

  // ---------------------------------------------------------------- 1. Phiếu chiều
  console.log('1. Phiếu chiều: E1 1 máy · E2 2 máy · E3 công việc khác');
  const pm = await post({
    overtime_date: NGAY, day_type: 'weekday', shift: 'PM',
    items: [
      { employee_id: 'E1', duration_hours: 3, equipment_id: 'M1', item_code: 'A1', planned_quantity: 15000 },
      { employee_id: 'E2', duration_hours: 4, equipment_id: 'M2', item_code: 'A2', planned_quantity: 25200 },
      { employee_id: 'E2', duration_hours: 4, equipment_id: 'M3', item_code: 'A3', planned_quantity: 10500 },
      { employee_id: 'E3', duration_hours: 3, is_other: true, other_description: 'Vệ sinh máy' },
    ],
  });
  ok(pm.status === 200, 'gửi phiếu chiều', pm.json);
  const hPm = await phieu(pm.json.id);
  ok(hPm.includes('Ký tên') && hPm.includes('Signature'), 'tiêu đề cột cuối "Ký tên / Signature"');
  ok(!hPm.includes('Ghi chú'), 'không còn chữ "Ghi chú"');
  ok(!hPm.includes('Tăng ca sáng'), 'phiếu chiều không có "Tăng ca sáng"');
  const g1 = luoi(hPm);
  ok(g1.loi.length === 0, 'mọi dòng đủ 12 cột', g1.loi);
  ok(JSON.stringify(g1.oKy.map((c) => c.rs)) === '[1,2,1]', 'ô ký gộp: E1 1 dòng · E2 2 dòng · E3 1 dòng', g1.oKy);
  ok(g1.oKy.every((c) => c.txt === ''), 'ô ký để trống');

  // ---------------------------------------------------------------- 2. Phiếu sáng
  console.log('2. Phiếu sáng: "Tăng ca sáng" lên dòng Bộ phận');
  const am = await post({
    overtime_date: NGAY, day_type: 'weekday', shift: 'AM',
    items: [
      { employee_id: 'E1', equipment_id: 'M1', item_code: 'A1', planned_quantity: 9000 },
      { employee_id: 'E1', equipment_id: 'M2', item_code: 'A2', planned_quantity: 9000 },
    ],
  });
  ok(am.status === 200, 'gửi phiếu sáng', am.json);
  const hAm = await phieu(am.json.id);
  ok((hAm.match(/Tăng ca sáng/g) ?? []).length === 1, '"Tăng ca sáng" đúng 1 lần');
  ok(/Bộ phận: <strong>HD<\/strong><strong> — Tăng ca sáng<\/strong>/.test(hAm), 'nằm cạnh Bộ phận: HD');
  const g2 = luoi(hAm);
  ok(g2.loi.length === 0 && g2.oKy.length === 1 && g2.oKy[0].rs === 2 && g2.oKy[0].txt === '',
    '1 ô ký trống gộp 2 dòng', g2);

  // ---------------------------------------------------------------- 3. Chủ nhật
  console.log('3. Chủ nhật');
  const cn = await post({
    overtime_date: CN, day_type: 'sunday',
    items: [{ employee_id: 'E3', equipment_id: 'M3', item_code: 'A3', planned_quantity: 5000 }],
  });
  ok(cn.status === 200, 'gửi phiếu CN', cn.json);
  const hCn = await phieu(cn.json.id);
  const g3 = luoi(hCn);
  ok(g3.loi.length === 0 && g3.oKy.length === 1 && !hCn.includes('Tăng ca sáng'), 'CN: 12 cột, 1 ô ký, không ghi sáng');

  // ---------------------------------------------------------------- 4. Excel tải về
  console.log('4. Excel tải về');
  const xp = await xlsx(pm.json.id);
  ok(xp.status === 200, 'tải Excel phiếu chiều');
  ok(String(xp.ws.getCell('M7').value).replace(/\r/g, '') === 'Ký tên\nSignature','M7 = Ký tên / Signature', xp.ws.getCell('M7').value);
  const merges: string[] = (xp.ws.model as { merges?: string[] }).merges ?? [];
  ok(merges.includes('M10:M11'), 'ô ký E2 gộp M10:M11', merges);
  ok([9, 10, 11, 12].every((r) => xp.ws.getCell(`M${r}`).value == null), 'ô ký trống');
  ok(!String(xp.ws.getCell('H5').value).includes('Tăng ca sáng'), 'H5 phiếu chiều không ghi sáng');
  const xa = await xlsx(am.json.id);
  ok(String(xa.ws.getCell('H5').value).startsWith('Bộ phận:  HD — Tăng ca sáng'), 'H5 phiếu sáng', xa.ws.getCell('H5').value);
  ok((xa.ws.model as { merges?: string[] }).merges?.includes('M9:M10') && xa.ws.getCell('M9').value == null,
    'phiếu sáng: ô ký gộp M9:M10, trống');

  // Ảnh để soi bằng mắt
  const wrap = (h: string) =>
    `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com/3.4.17"></script><style>${OT_PRINT_CSS}</style></head><body style="width:210mm;margin:0 auto">${h}</body></html>`;
  fs.writeFileSync(path.join(out, 'pm.html'), wrap(hPm));
  fs.writeFileSync(path.join(out, 'am.html'), wrap(hAm));
  console.log('   HTML để chụp:', out);

  console.log(`\nKẾT QUẢ: ${pass} đạt · ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
