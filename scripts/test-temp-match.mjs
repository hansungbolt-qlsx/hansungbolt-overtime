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
const { matchTempLine, matchAllTempLines, lotEq, kgEq, isStale, phanBoAux } =
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

console.log('\n=== 11. GÕ NHẦM Kg vẫn phải chọn được cuộn khác (user chốt 31/7 chiều) ===');
{
  // Ca Vĩnh Thành: nhập tay, lot trên app chính là SỐ PHIẾU NHẬP, trọng lượng
  // ghi tay dễ lệch. Gõ 1500 (trùng 2 cuộn) nhưng thực tế lấy cuộn 980.
  const coils = [
    coil(1, 'PN-2607-15', 1500, 'SWCH-5.5', '2026-07-20', 'VT-001'),
    coil(2, 'PN-2607-15', 1500, 'SWCH-5.5', '2026-07-25', 'VT-002'),
    coil(3, 'PN-2607-16', 980, 'SWCH-5.5', '2026-07-28', 'VT-003'),
  ];
  const m = matchTempLine(line('a', '', 1500, 'SWCH-5.5'), coils, new Set());
  check('vẫn gợi ý cuộn trùng Kg', m.pick?.id, 1);
  check('ô chọn có ĐỦ 3 cuộn', m.candidates.length, 3);
  check('cuộn trùng Kg xếp trước', m.candidates.map(c => c.id), [1, 2, 3]);
  check('chọn được cuộn 980kg', m.candidates.some(c => c.id === 3), true);
}

console.log('\n=== 12. Chưa gõ lot ≠ gõ sai lot (lời giải thích) ===');
{
  const coils = [coil(1, 'PN-2607-15', 1500, 'SWCH-5.5', '2026-07-20', 'VT-001')];
  const chuaGo = matchTempLine(line('a', '', 1500, 'SWCH-5.5'), coils, new Set());
  const goSai = matchTempLine(line('b', 'SAI-BET', 1500, 'SWCH-5.5'), coils, new Set());
  check('chưa gõ → "Chưa gõ lot"', chuaGo.reason.startsWith('Chưa gõ lot'), true);
  check('chưa gõ → KHÔNG nói "Lot không khớp"', chuaGo.reason.includes('Lot không khớp'), false);
  check('gõ sai → "Lot không khớp"', goSai.reason.startsWith('Lot không khớp'), true);
  check('cả hai vẫn gợi ý theo Kg', [chuaGo.verdict, goSai.verdict], ['kg_only', 'kg_only']);
}

console.log('\n=== 13. Không có cuộn nào trùng Kg → vẫn đủ danh sách ===');
{
  const coils = [
    coil(1, 'L1', 1500, 'SWCH-5.5', '2026-07-20'),
    coil(2, 'L2', 980, 'SWCH-5.5', '2026-07-25'),
  ];
  const m = matchTempLine(line('a', '', 1200, 'SWCH-5.5'), coils, new Set());
  check('không đoán bừa', m.pick, null);
  check('liệt kê đủ 2 cuộn', m.candidates.length, 2);
}

console.log('\n=== 14. KHÔNG ghép cuộn ĐÃ nằm trong phiếu hôm nay (vá 31/7) ===');
{
  // Kịch bản hỏng thật: tick cuộn 1 vào phiếu tay, rồi mở phiếu tạm ra kiểm tra.
  // Nếu app vẫn gợi ý cuộn 1 → phiếu có cùng cuộn 2 lần → app chính cộng ĐÔI Kg.
  const coils = [
    coil(1, 'L1', 2050, 'STS430-3.2', '2026-08-01'),
    coil(2, 'L1', 2050, 'STS430-3.2', '2026-08-02'),
  ];
  const daVaoPhieu = new Set([1]);          // cuộn 1 đã nằm trong phiếu hôm nay
  const con = coils.filter((c) => !daVaoPhieu.has(c.id));   // đúng cách màn hình lọc
  const m = matchTempLine(line('a', 'L1', 2050), con, new Set());
  check('KHÔNG gợi ý cuộn đã vào phiếu', m.pick?.id, 2);
  check('ô chọn cũng không có cuộn đó', m.candidates.some(c => c.id === 1), false);

  // Cuộn duy nhất đã bị dùng → không còn gì để ghép, phải báo rõ chứ không im.
  const m2 = matchTempLine(line('b', 'L1', 2050), coils.filter(c => c.id !== 1 && c.id !== 2), new Set());
  check('hết cuộn khả dụng → không đoán bừa', m2.pick, null);
  check('báo chưa có cuộn', m2.reason.includes('Chưa có cuộn nào'), true);
}

console.log('\n=== 15. Cảnh báo treo quá 24h ===');
{
  const old = { ...line('a', 'L1', 100), created_at: new Date(Date.now() - 25 * 3600_000).toISOString() };
  const fresh = { ...line('b', 'L1', 100), created_at: new Date(Date.now() - 3 * 3600_000).toISOString() };
  check('25h = treo', isStale(old), true);
  check('3h = chưa treo', isStale(fresh), false);
  check('đã chốt thì không tính treo', isStale({ ...old, status: 'merged' }), false);
}

console.log('\n=== 16. CHIA TỒN cho dòng tạm PHỤ LIỆU (phanBoAux) — user chốt 10/08 ===');
{
  // Dòng tạm phụ liệu: không có cuộn, không có lot. Chỉ mã + số lượng.
  const pl = (id, code, qty) => ({
    id, branch: 'aux', real_date: '2026-08-07', department: 'Rolling',
    material_code: code, lot_typed: null, qty, unit: 'EA',
    status: 'waiting', created_at: new Date().toISOString(),
  });
  const gon = (r) => r.map((a) => [a.line.id, a.chot, a.du]);

  // -- Ca cơ bản --
  check('tồn ĐỦ → chốt hết, không dư',
    gon(phanBoAux([pl('a', 'W1', 100)], new Map([['W1', 100]]))), [['a', 100, 0]]);
  check('tồn THỪA → chốt hết, không dư',
    gon(phanBoAux([pl('a', 'W1', 100)], new Map([['W1', 300]]))), [['a', 100, 0]]);
  check('tồn THIẾU → chốt phần có, GIỮ phần dư (đây là lỗi mất 40K)',
    gon(phanBoAux([pl('a', 'W1', 100)], new Map([['W1', 60]]))), [['a', 60, 40]]);
  check('tồn 0 → không chốt gì, giữ nguyên cả dòng',
    gon(phanBoAux([pl('a', 'W1', 100)], new Map([['W1', 0]]))), [['a', 0, 100]]);
  check('mã không có trong bảng tồn → coi như 0',
    gon(phanBoAux([pl('a', 'W9', 100)], new Map())), [['a', 0, 100]]);

  // -- Ca cộng đôi: HAI dòng CÙNG MÃ. Bản cũ cho cả hai lấy min(qty, tồn). --
  check('2 dòng cùng mã, tồn đủ cho 1,5 → dòng đầu full, dòng sau phần còn lại',
    gon(phanBoAux([pl('a', 'W1', 120), pl('b', 'W1', 120)], new Map([['W1', 180]]))),
    [['a', 120, 0], ['b', 60, 60]]);
  check('2 dòng cùng mã, tồn chỉ đủ dòng đầu → dòng sau chốt 0',
    gon(phanBoAux([pl('a', 'W1', 120), pl('b', 'W1', 120)], new Map([['W1', 120]]))),
    [['a', 120, 0], ['b', 0, 120]]);
  check('3 dòng cùng mã, tồn 0 → cả ba chốt 0',
    gon(phanBoAux([pl('a', 'W1', 10), pl('b', 'W1', 10), pl('c', 'W1', 10)],
      new Map([['W1', 0]]))), [['a', 0, 10], ['b', 0, 10], ['c', 0, 10]]);

  // -- Mã khác nhau thì không ăn tồn của nhau --
  check('2 mã khác nhau → độc lập',
    gon(phanBoAux([pl('a', 'W1', 100), pl('b', 'W2', 100)],
      new Map([['W1', 100], ['W2', 40]]))), [['a', 100, 0], ['b', 40, 60]]);

  // -- Dòng NVL phải bị BỎ QUA (NVL chốt nguyên cuộn, không chốt một phần) --
  const nvlLine = { ...pl('n', 'STS430-3.2', 500), branch: 'nvl' };
  check('bỏ qua dòng nhánh nvl',
    gon(phanBoAux([nvlLine, pl('a', 'W1', 10)], new Map([['W1', 10]]))), [['a', 10, 0]]);

  // -- Không được đổi Map của bên gọi --
  const ton = new Map([['W1', 100]]);
  phanBoAux([pl('a', 'W1', 60)], ton);
  check('KHÔNG sửa Map tồn của bên gọi', ton.get('W1'), 100);

  // -- Tổng bất biến: chốt + dư luôn = số gốc --
  const r = phanBoAux([pl('a', 'W1', 120), pl('b', 'W1', 120)], new Map([['W1', 150]]));
  check('bất biến: chốt + dư = số gốc từng dòng',
    r.map((a) => a.chot + a.du), [120, 120]);
  check('không chốt vượt tồn (tổng chốt ≤ tồn)',
    r.reduce((s, a) => s + a.chot, 0) <= 150, true);
}

console.log('\n=== 17. KHOÁ DÂY NỐI của F4 (phép kiểm MÃ NGUỒN) ===');
{
  // Vì sao kiểm mã nguồn: lỗi 07/08 và lỗi cộng đôi đều nằm ở CHỖ NỐI, không
  // nằm trong hàm thuần. `tsc` không bắt được "đọc lại tồn trong vòng lặp" hay
  // "quên gửi remain_qty", và repo không có bộ chạy thử DOM.
  // ⚠ PHẢI bỏ dòng chú thích trước khi soi. Bản đầu của phép kiểm này báo đỏ oan
  // vì chính chú thích "Bản cũ đọc lại `auxStock.get(code)`..." khớp chuỗi cần
  // tìm. Soi mã nguồn thì phải soi MÃ, không soi chữ giải thích.
  const boComment = (s) => s.split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');

  const panel = boComment(readFileSync('components/TempSlipPanel.tsx', 'utf8'));
  const api = boComment(readFileSync('app/api/nvl-temp/route.ts', 'utf8'));

  // ⚠ Mốc kết thúc phải là dòng CODE, không phải dòng chú thích: đã bỏ comment
  // nên mốc `// ---- Render` không còn tồn tại ⇒ indexOf trả −1 ⇒ lát cắt ăn gần
  // hết file và phép kiểm báo đỏ oan (đã dính đúng lỗi này).
  const iMerge = panel.indexOf('async function confirmMerge');
  const iHet = panel.indexOf('if (notReady) return null;', iMerge);
  const thanMerge = iMerge >= 0 && iHet > iMerge ? panel.slice(iMerge, iHet) : '';
  check('tìm được confirmMerge (lát cắt có mốc đầu VÀ mốc cuối hợp lệ)',
    thanMerge.length > 0 && thanMerge.length < 6000, true);

  // (a) Phải LẤY phần đã chia, KHÔNG đọc lại tồn trong vòng lặp
  check('confirmMerge dùng phanBo.find (phần đã chia)',
    thanMerge.includes('phanBo.find('), true);
  check('confirmMerge KHÔNG đọc lại auxStock.get trong vòng lặp',
    thanMerge.includes('auxStock.get('), false);

  // (b) Phải gửi cả prev_qty và remain_qty — thiếu prev_qty là mất chốt chặn
  check('gửi remain_qty (phần dư) lên máy chủ', thanMerge.includes('remain_qty:'), true);
  check('gửi prev_qty (chốt chặn lạc quan)', thanMerge.includes('prev_qty:'), true);

  // (c) Phải soi skipped — bỏ sót mà im lặng là lần sau ghi ĐÔI
  check('đọc d.skipped sau khi PATCH', /Array\.isArray\(d\.skipped\)/.test(thanMerge), true);

  // (d) Máy chủ: nhánh chốt một phần phải GIỮ waiting và có chốt chặn theo qty
  const iPatch = api.indexOf('export async function PATCH');
  const thanPatch = iPatch >= 0
    ? api.slice(iPatch, api.indexOf('export async function DELETE', iPatch)) : '';
  check('tìm được PATCH', thanPatch.length > 0, true);
  // ⚠ ĐỪNG chỉ canh chuỗi 'it.remain_qty': để lại `void it.remain_qty;` là chuỗi
  // vẫn còn mà nhánh đã chết. Phải canh CÂU LỆNH ĐỌC giá trị vào biến điều kiện,
  // và canh cả điều kiện rẽ nhánh. (Phép phá M1 lọt qua bản đầu đúng vì lỗi này.)
  check('PATCH thật sự ĐỌC remain_qty vào biến điều kiện',
    /const\s+\w+\s*=\s*Number\(it\.remain_qty\)/.test(thanPatch), true);
  check('PATCH rẽ nhánh theo biến đó (isFinite && > 0)',
    /Number\.isFinite\(\w+\)\s*&&\s*\w+\s*>\s*0/.test(thanPatch), true);
  check("PATCH chốt chặn theo .eq('qty', truoc)",
    thanPatch.includes(".eq('qty', truoc)"), true);
  check("PATCH nhánh một phần vẫn .eq('status','waiting')",
    (thanPatch.match(/\.eq\('status', 'waiting'\)/g) || []).length >= 2, true);
  // Nhánh một phần TUYỆT ĐỐI không được đặt status='merged'
  const iCon = thanPatch.indexOf('it.remain_qty');
  const nhanhCon = iCon >= 0 ? thanPatch.slice(iCon, thanPatch.indexOf('continue;', iCon)) : '';
  check('nhánh một phần KHÔNG đánh dấu merged',
    nhanhCon.includes("status: 'merged'"), false);
  check('nhánh một phần CÓ cập nhật qty', /update\(\{\s*qty:\s*con/.test(nhanhCon), true);
}

console.log(`\n========================================\nPASS ${pass} · FAIL ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
