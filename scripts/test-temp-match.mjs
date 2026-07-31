// ===========================================================================
// TEST logic đối chiếu PHIẾU XUẤT KHO TẠM (31/07/2026)
//
// Chạy: node scripts/test-temp-match.mjs
// Không đụng DB, không gọi mạng — chỉ kiểm tra thuần logic ghép cuộn.
//
// Vì sao phải có: đây là chỗ dễ sai nhất của tính năng — ghép nhầm cuộn thì sổ
// sách ghi cuộn A đã xuất trong khi thực tế dùng cuộn C, truy vết lot hỏng âm thầm.
// ===========================================================================

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Biên dịch 2 file TS cần thiết sang JS để import (không cần ts-node).
// Chép CẢ nvl-slips.ts vì nvl-temp.ts import kiểu từ đó — bỏ import đi thì tsc
// mất định nghĩa StockCoil và báo lỗi.
const dir = mkdtempSync(join(tmpdir(), 'tempmatch-'));
writeFileSync(join(dir, 'nvl-slips.ts'), readFileSync('lib/nvl-slips.ts', 'utf8'));
writeFileSync(join(dir, 'nvl-temp.ts'), readFileSync('lib/nvl-temp.ts', 'utf8'));
execSync(`npx tsc "${join(dir, 'nvl-temp.ts')}" --target es2022 --module es2022 --moduleResolution bundler --outDir "${dir}"`,
  { stdio: 'inherit' });
const { matchTempLine, matchAllTempLines, lotEq, kgEq, isStale } =
  await import(`file://${join(dir, 'nvl-temp.js')}`);

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
}

const coil = (id, lot, kg, code = 'STS430-3.2', received = '2026-08-01', coilNo = `C${id}`) =>
  ({ id, coil_no: coilNo, lot_no: lot, kg, code, name: 'STS430', size: '3.2', received_at: received, issued_at: null });

const line = (id, lot, qty, code = 'STS430-3.2') => ({
  id, branch: 'nvl', real_date: '2026-07-31', department: 'Heading',
  material_code: code, lot_typed: lot, qty, unit: 'KG',
  status: 'waiting', created_at: new Date().toISOString(),
});

console.log('\n=== 1. Khớp cả lot lẫn Kg ===');
{
  const coils = [coil(1, '2607A', 2050), coil(2, '2607A', 1980), coil(3, '2607B', 2100)];
  const m = matchTempLine(line('a', '2607A', 2050), coils, new Set());
  check('chọn đúng cuộn 1', m.pick?.id, 1);
  check('verdict exact', m.verdict, 'exact');
}

console.log('\n=== 2. Nhiều cuộn CÙNG lot CÙNG Kg → lấy cuộn nhập trước nhất ===');
{
  const coils = [
    coil(7, '2607A', 2050, 'STS430-3.2', '2026-08-03'),
    coil(5, '2607A', 2050, 'STS430-3.2', '2026-08-01'),   // cũ nhất
    coil(6, '2607A', 2050, 'STS430-3.2', '2026-08-02'),
  ];
  const m = matchTempLine(line('a', '2607A', 2050), coils, new Set());
  check('lấy cuộn nhập trước nhất', m.pick?.id, 5);
  check('verdict exact', m.verdict, 'exact');
}

console.log('\n=== 3. Lot gõ SAI nhưng Kg đúng → gợi ý cuộn Kg đúng, lot cũ nhất ===');
{
  const coils = [
    coil(2, '2607B', 2050, 'STS430-3.2', '2026-08-05'),
    coil(1, '2607A', 2050, 'STS430-3.2', '2026-08-02'),   // cũ hơn
  ];
  const m = matchTempLine(line('a', '2607X', 2050), coils, new Set());
  check('gợi ý cuộn lot cũ nhất', m.pick?.id, 1);
  check('verdict kg_only', m.verdict, 'kg_only');
}

console.log('\n=== 4. Kg SAI → KHÔNG đoán bừa ===');
{
  const coils = [coil(1, '2607A', 2050), coil(2, '2607A', 1980)];
  const m = matchTempLine(line('a', '2607A', 2000), coils, new Set());
  check('không gợi ý cuộn nào', m.pick, null);
  check('verdict none', m.verdict, 'none');
  check('vẫn trả danh sách để chọn tay', m.candidates.length, 2);
}

console.log('\n=== 5. Kg phải khớp TUYỆT ĐỐI (user chốt: không ngoại lệ) ===');
{
  const coils = [coil(1, '2607A', 2050)];
  check('lệch 0,5 kg = KHÔNG khớp', matchTempLine(line('a', '2607A', 2050.5), coils, new Set()).pick, null);
  check('lệch 0,001 kg = KHÔNG khớp', matchTempLine(line('a', '2607A', 2050.001), coils, new Set()).pick, null);
  check('bằng đúng = khớp', matchTempLine(line('a', '2607A', 2050), coils, new Set()).pick?.id, 1);
  check('kgEq né sai số dấu phẩy động', kgEq(0.1 + 0.2, 0.3), true);
}

console.log('\n=== 6. Hàng Vĩnh Thành không có lot → so với SỐ HIỆU CUỘN ===');
{
  const coils = [coil(9, '', 1500, 'SWCH-5.5', '2026-08-01', 'VT2607-11')];
  const m = matchTempLine(line('a', 'VT2607-11', 1500, 'SWCH-5.5'), coils, new Set());
  check('khớp qua coil_no', m.pick?.id, 9);
  check('verdict exact', m.verdict, 'exact');
}

console.log('\n=== 7. So lot KHÔNG được nới lỏng (bài học KOS/Vĩnh Thành) ===');
{
  check('bỏ khoảng trắng + hoa/thường: khớp', lotEq(' 2607a ', '2607A'), true);
  check('thiếu 1 ký tự: KHÔNG khớp', lotEq('2607', '2607A'), false);
  check('khác dấu gạch: KHÔNG khớp', lotEq('2607-A', '2607A'), false);
  check('rỗng: KHÔNG khớp', lotEq('', ''), false);
}

console.log('\n=== 8. Hai dòng KHÔNG được ăn cùng một cuộn ===');
{
  const coils = [
    coil(1, '2607A', 2050, 'STS430-3.2', '2026-08-01'),
    coil(2, '2607A', 2050, 'STS430-3.2', '2026-08-02'),
  ];
  const ms = matchAllTempLines([line('a', '2607A', 2050), line('b', '2607A', 2050)], coils);
  check('dòng 1 ăn cuộn cũ nhất', ms[0].pick?.id, 1);
  check('dòng 2 ăn cuộn còn lại', ms[1].pick?.id, 2);
}

console.log('\n=== 9. Ba dòng nhưng chỉ 2 cuộn → dòng thứ 3 không có gì ===');
{
  const coils = [coil(1, 'L1', 100), coil(2, 'L1', 100)];
  const ms = matchAllTempLines(
    [line('a', 'L1', 100), line('b', 'L1', 100), line('c', 'L1', 100)], coils);
  check('dòng 3 không ghép được', ms[2].pick, null);
}

console.log('\n=== 10. Mã chưa có cuộn nào trong kho ===');
{
  const m = matchTempLine(line('a', 'L1', 100, 'CHUA-VE'), [coil(1, 'L1', 100)], new Set());
  check('không ghép', m.pick, null);
  check('báo chưa có cuộn', m.reason.includes('Chưa có cuộn nào'), true);
}

console.log('\n=== 11. Cảnh báo treo quá 24h ===');
{
  const old = { ...line('a', 'L1', 100), created_at: new Date(Date.now() - 25 * 3600_000).toISOString() };
  const fresh = { ...line('b', 'L1', 100), created_at: new Date(Date.now() - 3 * 3600_000).toISOString() };
  check('25h = treo', isStale(old), true);
  check('3h = chưa treo', isStale(fresh), false);
  check('đã chốt thì không tính treo', isStale({ ...old, status: 'merged' }), false);
}

console.log(`\n========================================\nPASS ${pass} · FAIL ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
