/**
 * BÀI KIỂM — CẢNH BÁO TRƯỚC KHI RỜI MÀN KHI CÒN DÒNG CHƯA LƯU.
 *
 * Vá 14/08/2026: anh Cường mất 6 dòng S18A vì giỏ dòng đang gõ chỉ nằm trong bộ
 * nhớ trang — chuyển tab là bay sạch, không một lời cảnh báo.
 *
 * Bài này kiểm PHẦN LÕI (hàm thuần) — thứ dễ sai thầm lặng nhất:
 *   · `demDongChuaLuu`   đếm đúng số dòng đang treo trong mọi ca, kể cả ca xoá
 *                        bớt dòng và ca chưa nạp được phiếu
 *   · `hoiTruocKhiRoiDi` KHÔNG hỏi khi sạch (nếu không thì mỗi cú chạm tab đều
 *                        bật hộp thoại → người dùng bấm OK theo phản xạ, cảnh
 *                        báo mất thiêng đúng như lỗi "báo động giả 3 giây")
 *                        và PHẢI hỏi khi bẩn, trả đúng lựa chọn của người dùng.
 *
 * Phần NỐI DÂY (4 cửa: 7 tab · đổi nhánh · đổi ngày · nút Về hôm nay) là hành vi
 * giao diện, bài này KHÔNG với tới — phải kiểm tay trên trình duyệt.
 *
 *   npx tsx scripts/test/canh_bao_chua_luu_verify.ts
 */
import { demDongChuaLuu, hoiTruocKhiRoiDi } from '../../lib/nvl-slips';

let dat = 0;
let hong = 0;
const kiem = (ok: boolean, ten: string, them = '') => {
  console.log(`   ${ok ? '✓' : '✗'} ${ten}${them ? ` — ${them}` : ''}`);
  if (ok) dat += 1; else hong += 1;
};

console.log('1. demDongChuaLuu — đếm số dòng đang treo');
kiem(demDongChuaLuu(false, 6, 6) === 0, 'giỏ sạch → 0, không phiền người dùng');
kiem(demDongChuaLuu(false, 9, 6) === 0,
     'cờ sạch thì dù số lệch vẫn 0 (vừa nạp xong, chưa gõ gì)');
kiem(demDongChuaLuu(true, 9, 6) === 3,
     '⭐ đúng ca anh Cường: giỏ 9, máy chủ 6 → treo 3 dòng',
     String(demDongChuaLuu(true, 9, 6)));
kiem(demDongChuaLuu(true, 6, 6) === 1,
     'sửa mà số không đổi (xoá 1 thêm 1) → vẫn tính là có thay đổi');
kiem(demDongChuaLuu(true, 4, 6) === 1,
     'XOÁ BỚT dòng → phần dôi âm nhưng vẫn phải hỏi lại',
     String(demDongChuaLuu(true, 4, 6)));
kiem(demDongChuaLuu(true, 3, null) === 3,
     'chưa nạp được phiếu → coi CẢ GIỎ là đang treo (thà thừa hơn sót)');
kiem(demDongChuaLuu(true, 0, null) === 1, 'giỏ rỗng mà cờ bẩn → vẫn ≥ 1');
kiem(demDongChuaLuu(false, 0, null) === 0, 'sạch + chưa nạp → 0, không hỏi');

console.log('\n2. hoiTruocKhiRoiDi — chỉ hỏi khi THẬT SỰ có gì để mất');
let soLanHoi = 0;
let traLoi = true;
// jsdom không có ở dự án này; hộp thoại chỉ cần đúng giao kèo nên dựng tay.
(globalThis as unknown as { window: { confirm: (s: string) => boolean } }).window = {
  confirm: (s: string) => { soLanHoi += 1; noiDung = s; return traLoi; },
};
let noiDung = '';

soLanHoi = 0;
kiem(hoiTruocKhiRoiDi(0) === true, 'sạch → cho đi luôn');
kiem(soLanHoi === 0, '⭐ sạch thì TUYỆT ĐỐI không bật hộp thoại', `${soLanHoi} lần`);

soLanHoi = 0;
kiem(hoiTruocKhiRoiDi(-1) === true, 'số âm (phòng hờ) → cho đi, không hỏi');
kiem(soLanHoi === 0, 'không hỏi', `${soLanHoi} lần`);

soLanHoi = 0; traLoi = false;
kiem(hoiTruocKhiRoiDi(3) === false, '⭐ còn 3 dòng + người dùng bấm HUỶ → Ở LẠI');
kiem(soLanHoi === 1, 'có hỏi đúng 1 lần', `${soLanHoi} lần`);
kiem(noiDung.includes('3'), 'câu hỏi nói rõ SỐ DÒNG sắp mất');
kiem(noiDung.includes('CHƯA LƯU'), 'câu hỏi nói rõ là chưa lưu');

soLanHoi = 0; traLoi = true;
kiem(hoiTruocKhiRoiDi(3) === true,
     'còn 3 dòng + người dùng bấm OK → VẪN ĐI ĐƯỢC (không chặn cứng, '
     + 'mạng chập không nhốt được nhân viên kho)');
kiem(soLanHoi === 1, 'có hỏi đúng 1 lần', `${soLanHoi} lần`);

console.log(`\n${'='.repeat(60)}`);
console.log(hong === 0 ? `✅ ĐẠT ${dat}/${dat} phép kiểm` : `🛑 HỎNG ${hong}, đạt ${dat}`);
console.log('='.repeat(60));
process.exit(hong === 0 ? 0 : 1);
