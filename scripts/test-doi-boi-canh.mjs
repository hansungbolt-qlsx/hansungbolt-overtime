// ===========================================================================
// TEST CHỐNG TÁI DIỄN — "dòng nhánh này lọt sang phiếu nhánh khác" (B30)
//
// Chạy: node scripts/test-doi-boi-canh.mjs
// Không gọi mạng, không đụng DB — chỉ SOI MÃ NGUỒN.
//
// SỰ CỐ THẬT 08/08/2026: phiếu `ot-2026-08-08-issue-aux-1` sinh ra mang 27 dòng
// NGUYÊN LIỆU (bản sao y hệt phiếu xuất NVL: cùng mã, cùng số cuộn, cùng lot,
// cùng Kg, cùng giờ đợt) + 1 dòng washer thật. Người duyệt phải từ chối cả phiếu
// rồi nhập tay lại trên app chính — mất ~20 phút.
//
// Vì sao kiểm bằng cách soi mã nguồn: lỗi nằm ở CHỖ NỐI giữa thao tác đổi tab và
// state React. `tsc` KHÔNG bắt được "quên gọi hàm", còn repo này không có bộ chạy
// thử DOM. Soi mã nguồn là cách rẻ nhất khoá đúng điều kiện đã gây ra sự cố.
// ===========================================================================

import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ''}`); }
}

const VIEW = 'components/WarehouseSlipView.tsx';
const LAYOUT = 'components/RegisterLayout.tsx';
const view = readFileSync(VIEW, 'utf8');
const layout = readFileSync(LAYOUT, 'utf8');
const dong = view.split('\n');

console.log('\n=== 1. Hàm dốc rổ tồn tại và dốc ĐỦ ===');
const mHelper = view.match(/const xoaBoiCanh = useCallback\(\(\) => \{([\s\S]*?)\}, \[\]\);/);
check('có hàm xoaBoiCanh', mHelper !== null);
const than = mHelper ? mHelper[1] : '';
// Năm thứ này thuộc về bối cảnh (kind, branch, viewDate) — đổi bối cảnh là phải
// bỏ hết, không được giữ lại thứ nào của bối cảnh cũ.
for (const [ten, mau] of [
  ['lines', 'setLines([])'],
  ['slip', 'setSlip(null)'],
  ['slipNote', "setSlipNote('')"],
  ['past', 'setPast([])'],
  ['events', 'setEvents([])'],
]) {
  check(`xoá ${ten}`, than.includes(mau), `không thấy ${mau} trong thân hàm`);
}

console.log('\n=== 2. MỌI chỗ đổi bối cảnh đều dốc rổ ===');
// Đây là phép kiểm quan trọng nhất: thêm một nút đổi nhánh/đổi ngày mới mà quên
// gọi xoaBoiCanh là lỗi 08/08 tái diễn nguyên vẹn.
const goi = [];
dong.forEach((l, i) => {
  if (/\bsetBranch\(|\bsetViewDate\(/.test(l)) goi.push({ so: i + 1, l: l.trim() });
});
check(`tìm được ${goi.length} chỗ đổi bối cảnh (mong ≥ 3)`, goi.length >= 3);
for (const g of goi) {
  check(`dòng ${g.so} có gọi xoaBoiCanh`, g.l.includes('xoaBoiCanh('), g.l.slice(0, 110));
}

console.log('\n=== 3. CỐ Ý không dốc rổ trong catch của loadSlip ===');
// Nếu xoá lines ở đây thì: Lưu xong → loadSlip chạy lại → lần nạp đó lỗi → phiếu
// vừa lưu trông như TRỐNG → người dùng gõ lại từ đầu → GHI TRÙNG. Tệ hơn lỗi B30.
const mLoad = view.match(/const loadSlip = useCallback\(async \(\) => \{([\s\S]*?)\}, \[kind, branch, viewDate\]\);/);
check('tìm được hàm loadSlip', mLoad !== null);
if (mLoad) {
  const i = mLoad[1].lastIndexOf('catch (e)');
  const duoi = i >= 0 ? mLoad[1].slice(i) : '';
  check('có nhánh catch', i >= 0);
  check('catch KHÔNG xoá lines (cố ý)', !/setLines\s*\(/.test(duoi), duoi.trim().slice(0, 120));
}

console.log('\n=== 4. Giả định "đổi Xuất↔Trả tự về rỗng" còn đúng ===');
// Lưới an toàn của kind dựa vào việc component bị THÁO rồi DỰNG LẠI. Nếu ai đó
// biến kind thành state trong component, hoặc render 1 instance dùng chung, thì
// dòng xuất kho lọt được sang phiếu TRẢ KHO — mà trả kho SINH tồn.
check('kind là PROP, không phải state',
  /function WarehouseSlipView\(\{\s*kind\s*\}/.test(view) && !/useState<Kind>/.test(view));
check('RegisterLayout render 2 instance TÁCH RIÊNG theo activeTab',
  /activeTab === 'wh_out' && <WarehouseSlipView kind="issue" \/>/.test(layout)
  && /activeTab === 'wh_in' && <WarehouseSlipView kind="return" \/>/.test(layout));

console.log(`\n========================================\nPASS ${pass} · FAIL ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
