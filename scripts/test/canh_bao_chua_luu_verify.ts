/**
 * BÀI KIỂM — CHẶN RỜI MÀN KHI CÒN VIỆC DỞ (phần lõi, hàm thuần).
 *
 * Vá 14/08/2026: anh Cường mất 6 dòng S18A vì giỏ dòng đang gõ chỉ nằm trong bộ
 * nhớ trang — chuyển tab là bay sạch, không một lời cảnh báo.
 *
 * Có HAI tầng việc dở, cả hai đều phải chặn (anh Hữu chốt chiều 14/08):
 *   tầng 1 — đã bấm "➕ Thêm vào phiếu", chưa bấm Lưu
 *   tầng 2 — MỚI TICK CUỘN, chưa bấm ➕   ← chỗ dễ quên nhất, trước đó KHÔNG che
 *
 * Bài này kiểm phần lõi. Phần nối dây (4 cửa) do
 * `hop_hoi_roi_man_browser_verify.py` kiểm trên trình duyệt thật.
 *
 *   npx tsx scripts/test/canh_bao_chua_luu_verify.ts
 */
import { canhBaoChuaLuu, chanNeuChuaLuu, demDongChuaLuu } from '../../lib/nvl-slips';

let dat = 0;
let hong = 0;
const kiem = (ok: boolean, ten: string, them = '') => {
  console.log(`   ${ok ? '✓' : '✗'} ${ten}${them ? ` — ${them}` : ''}`);
  if (ok) dat += 1; else hong += 1;
};

console.log('1. demDongChuaLuu — đếm dòng đã vào giỏ mà chưa Lưu');
kiem(demDongChuaLuu(false, 6, 6) === 0, 'giỏ sạch → 0, không phiền người dùng');
kiem(demDongChuaLuu(false, 9, 6) === 0, 'cờ sạch thì dù số lệch vẫn 0');
kiem(demDongChuaLuu(true, 9, 6) === 3,
     '⭐ đúng ca anh Cường: giỏ 9, máy chủ 6 → treo 3 dòng');
kiem(demDongChuaLuu(true, 6, 6) === 1, 'xoá 1 thêm 1 → vẫn tính là có thay đổi');
kiem(demDongChuaLuu(true, 4, 6) === 1, 'XOÁ BỚT dòng → vẫn cảnh báo (giỏ còn dòng, Lưu được)');
kiem(demDongChuaLuu(true, 3, null) === 3, 'chưa nạp được phiếu → coi CẢ GIỎ là treo');
kiem(demDongChuaLuu(false, 0, null) === 0, 'sạch + chưa nạp → 0');
// ⭐ PHÉP CHỐNG BẪY CHẾT — thêm 1 dòng rồi ĐỔI Ý XOÁ đi thì giỏ rỗng. Nếu chỗ này
// trả 1 thì với cửa CHẶN HẲN người dùng KHÔNG CÒN ĐƯỜNG RA: phiếu rỗng không Lưu
// được, mà không Lưu thì không chuyển tab được.
kiem(demDongChuaLuu(true, 0, 0) === 0,
     '⭐ thêm rồi XOÁ HẾT → 0, KHÔNG được khoá người dùng trong tab');
kiem(demDongChuaLuu(true, 0, null) === 0, '⭐ giỏ rỗng + chưa nạp được → cũng cho đi');

console.log('\n2. canhBaoChuaLuu — câu nhắn phải nói đúng thứ đang mất');
kiem(canhBaoChuaLuu(0, 0) === '', '⭐ sạch cả hai tầng → chuỗi RỖNG (không chặn)');
const a = canhBaoChuaLuu(2, 3);
kiem(a.includes('2 DÒNG CHƯA LƯU') && a.includes('3 CUỘN ĐANG CHỌN DỞ'),
     '⭐ có cả hai tầng → nêu CẢ HAI', a.split('\n')[0]);
kiem(a.includes(' và '), 'nối bằng "và" đúng như anh Hữu duyệt');
const b = canhBaoChuaLuu(0, 5);
kiem(b.includes('5 CUỘN ĐANG CHỌN DỞ') && !b.includes('DÒNG CHƯA LƯU'),
     'CHỈ tick cuộn, chưa thêm dòng nào → chỉ nêu tầng 2', b.split('\n')[0]);
kiem(b !== '', '⭐ mới tick thôi cũng CHẶN — đây là chỗ dễ quên nhất');
const c = canhBaoChuaLuu(4, 0);
kiem(c.includes('4 DÒNG CHƯA LƯU') && !c.includes('ĐANG CHỌN DỞ'),
     'chỉ có dòng chưa lưu → chỉ nêu tầng 1', c.split('\n')[0]);
const d = canhBaoChuaLuu(0, 2, 'MỤC');
kiem(d.includes('2 MỤC ĐANG CHỌN DỞ'), 'phụ liệu dùng chữ MỤC, không phải CUỘN',
     d.split('\n')[0]);
kiem(a.includes('Thêm vào phiếu') && a.includes('Lưu phiếu'),
     '⭐ chỉ đúng đường thoát LUÔN chạy được (➕ rồi Lưu)');
kiem(a.includes('bỏ tích') && a.includes('xoá dòng'), 'và nêu cả đường bỏ đi');

console.log('\n3. chanNeuChuaLuu — MỘT nút, không có đường "vẫn đi"');
let soLanBao = 0;
let noiDung = '';
(globalThis as unknown as { window: { alert: (s: string) => void } }).window = {
  alert: (s: string) => { soLanBao += 1; noiDung = s; },
};

soLanBao = 0;
kiem(chanNeuChuaLuu('') === true, 'sạch → cho đi');
kiem(soLanBao === 0, '⭐ sạch thì TUYỆT ĐỐI không bật hộp nào', `${soLanBao} lần`);

soLanBao = 0;
kiem(chanNeuChuaLuu(a) === false,
     '⭐ còn việc dở → CHẶN, không có cách nào đi tiếp trong hộp thoại');
kiem(soLanBao === 1, 'bật hộp đúng 1 lần', `${soLanBao} lần`);
kiem(noiDung === a, 'hiện đúng câu nhắn đã dựng');

// ⚠ Phép chốt của ĐẢO QUYẾT ĐỊNH chiều 14/08: bản trưa dùng hộp HAI nút và trả
// `true` khi người dùng bấm "vẫn đi". Nút đó chính là chỗ hỏng — bấm cho qua
// theo phản xạ là mất dữ liệu. Nay KHÔNG lối vào nào trả `true` khi còn việc dở.
soLanBao = 0;
const luonChan = [canhBaoChuaLuu(1, 0), canhBaoChuaLuu(0, 1), canhBaoChuaLuu(9, 9)]
  .every((m) => chanNeuChuaLuu(m) === false);
kiem(luonChan, '⭐ MỌI trường hợp còn việc dở đều bị chặn — không có ngoại lệ');
kiem(soLanBao === 3, 'mỗi lần đều có báo', `${soLanBao} lần`);

console.log(`\n${'='.repeat(60)}`);
console.log(hong === 0 ? `✅ ĐẠT ${dat}/${dat} phép kiểm` : `🛑 HỎNG ${hong}, đạt ${dat}`);
console.log('='.repeat(60));
process.exit(hong === 0 ? 0 : 1);
