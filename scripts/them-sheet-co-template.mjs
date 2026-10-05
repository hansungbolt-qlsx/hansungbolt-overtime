// Thêm sheet 'CO' (Coating) vào public/templates/overtime-form.xlsx bằng CHÍNH exceljs (thư viện route export dùng).
// Vì sao không dùng openpyxl: openpyxl ghi lại file làm exceljs không load được (TypeError 'anchors', 05/10/2026)
// → export HỎNG cho CẢ HD/RL. Chạy:  node scripts/them-sheet-co-template.mjs   (idempotent: đã có sheet CO thì chỉ kiểm)
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const PATH = 'public/templates/overtime-form.xlsx';
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(readFileSync(PATH));
console.log('sheets trước:', wb.worksheets.map((w) => w.name).join(', '));
const rl = wb.getWorksheet('RL');
if (!rl) throw new Error('thiếu sheet RL');

if (!wb.getWorksheet('CO')) {
  copyFileSync(PATH, PATH + '.truoc-them-CO.bak');
  const co = wb.addWorksheet('CO', { pageSetup: { ...rl.pageSetup }, properties: { ...rl.properties }, views: rl.views });
  // cột: rộng + style
  rl.columns.forEach((c, i) => {
    const t = co.getColumn(i + 1);
    if (c.width) t.width = c.width;
    if (c.hidden) t.hidden = c.hidden;
  });
  // ô: giá trị + style + chiều cao dòng
  rl.eachRow({ includeEmpty: true }, (row, r) => {
    const tr = co.getRow(r);
    if (row.height) tr.height = row.height;
    row.eachCell({ includeEmpty: true }, (cell, cidx) => {
      const tc = tr.getCell(cidx);
      tc.value = cell.value;
      tc.style = JSON.parse(JSON.stringify(cell.style));
    });
    tr.commit();
  });
  // ô gộp
  for (const m of rl.model.merges ?? []) co.mergeCells(m);
  // ảnh (logo) — cùng media id, cùng vùng neo
  for (const img of rl.getImages()) {
    co.addImage(img.imageId, { tl: { ...img.range.tl }, br: img.range.br ? { ...img.range.br } : undefined, ext: img.range.ext, editAs: img.range.editAs });
  }
  // vùng in theo RL (B1:M15) + tiêu đề bộ phận
  if (rl.pageSetup?.printArea) co.pageSetup.printArea = rl.pageSetup.printArea;
  co.getCell('H5').value = 'Bộ phận:  CO\nDepartment:';
  // tên vùng in kiểu định nghĩa (nếu RL có) → bỏ qua, route export không dùng
  writeFileSync(PATH, Buffer.from(await wb.xlsx.writeBuffer()));
  console.log('đã ghi sheet CO');
}

// Kiểm: load lại được, sheet CO có đủ ô gộp/ảnh như RL
const wb2 = new ExcelJS.Workbook();
await wb2.xlsx.load(readFileSync(PATH));
const r2 = wb2.getWorksheet('RL'); const c2 = wb2.getWorksheet('CO');
console.log('sheets sau:', wb2.worksheets.map((w) => w.name).join(', '));
console.log('RL merges', r2.model.merges.length, 'CO merges', c2.model.merges.length, '| RL images', r2.getImages().length, 'CO images', c2.getImages().length);
console.log('CO H5 =', JSON.stringify(c2.getCell('H5').value), '| B9 =', JSON.stringify(c2.getCell('B9').value), '| printArea', c2.pageSetup.printArea, '| orient', c2.pageSetup.orientation);
const bad = ['B9:M9', 'H10:H11', 'M10:M11', 'I10:I11', 'B13:M14', 'B15:M16'].filter((m) => !c2.model.merges.includes(m));
console.log(bad.length ? 'THIẾU merge DATA_MERGES: ' + bad.join(',') : 'CO có đủ 6 vùng gộp DATA_MERGES');
