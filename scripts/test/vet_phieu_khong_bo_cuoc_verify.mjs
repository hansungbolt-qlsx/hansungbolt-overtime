/**
 * BÀI KIỂM — VÒNG VÉT PHIẾU KHÔNG ĐƯỢC BỎ CUỘC KHI ĐẨY TỒN LỖI (15/09/2026).
 *
 * Sự cố 12/09 + 14/09: 16:30 agent đẩy tồn, Supabase trả "Gateway Timeout" ⇒
 * syncNvlOnce ném lỗi TRƯỚC khi tới bước vét phiếu, mà `sweptToday` đã ghi ⇒ cả
 * ngày không vét lại ⇒ phiếu nháp 14/9 nằm im. Bài này bóc hàm syncNvlOnce ra khỏi
 * agent.js (KHÔNG chạy agent thật, KHÔNG gọi mạng, KHÔNG chạm dữ liệu nào) rồi thay
 * 3 bước bằng hàm giả để dựng đúng kịch bản đó.
 *
 * Cách chạy:  node scripts/test/vet_phieu_khong_bo_cuoc_verify.mjs [đường dẫn agent.js]
 * Bản CHƯA vá phải ĐỎ ở 3 bài đầu; bản đã vá phải XANH 6/6.
 */
import { readFileSync } from 'node:fs';

const FILE = process.argv[2] || new URL('../../print-agent/agent.js', import.meta.url);
const src = readFileSync(FILE, 'utf8');
const m = src.match(/async function syncNvlOnce\(\) \{[\s\S]*?\n\}\n/);
if (!m) { console.error('KHÔNG bóc được syncNvlOnce'); process.exit(2); }

/** Dựng syncNvlOnce trong "hộp" riêng: biến trạng thái + 3 bước giả. */
function dung(kichBan) {
  const goi = [];
  const box = {
    MAIN_APP_URL: 'x', MAIN_APP_TOKEN: 'x', SWEEP_AT: '16:30',
    sweptToday: '', sweepOnStartDone: kichBan.daKhoiDong ?? true,
    vnDate: () => '2026-09-14',
    vnHHMM: () => kichBan.gio ?? '16:30',
    console: { log: () => {}, error: (s) => goi.push('LOG:' + s.replace(/^\[.*?\] /, '')) },
    pushNvlStock: async () => { goi.push('stock'); if (kichBan.stockLoi) throw new Error('app tăng ca /api/nvl-stock HTTP 500 {"error":"Gateway Timeout"}'); },
    pushNvlSlips: async (sw) => { goi.push('slips:' + sw); if (kichBan.slipsLoi) throw new Error('slips hỏng'); },
    pullNvlStatuses: async () => { goi.push('status'); },
  };
  // Biến trạng thái phải là `let` trong hộp để hàm gán được → khai báo lại bên trong.
  const wrap = new Function(...Object.keys(box).filter(k => !['sweptToday','sweepOnStartDone'].includes(k)),
    `let sweptToday = ${JSON.stringify(box.sweptToday)}; let sweepOnStartDone = ${box.sweepOnStartDone};\n` +
    m[0] + '\nreturn { run: syncNvlOnce, st: () => ({ sweptToday, sweepOnStartDone }) };');
  const vals = Object.keys(box).filter(k => !['sweptToday','sweepOnStartDone'].includes(k)).map(k => box[k]);
  const h = wrap(...vals);
  return { h, goi };
}

let dat = 0, hong = 0;
async function bai(ten, kb, kiem) {
  const { h, goi } = dung(kb);
  let loi = null;
  try { await h.run(); } catch (e) { loi = e.message; }
  const ok = kiem({ goi, st: h.st(), loi });
  console.log(`${ok ? '✅' : '❌'} ${ten}\n     gọi: ${goi.join(' → ')} · trạng thái: ${JSON.stringify(h.st())}${loi ? ' · ném lỗi: ' + loi : ''}`);
  ok ? dat++ : hong++;
}

// 1. Kịch bản THẬT 14/9: 16:30, đẩy tồn lỗi → vẫn phải vét phiếu eod + kéo trạng thái
await bai('16:30 đẩy tồn lỗi → vẫn vét phiếu (eod) và kéo trạng thái', { stockLoi: true },
  ({ goi }) => goi.includes('slips:eod') && goi.includes('status'));
// 2. Đẩy tồn lỗi → hàm KHÔNG ném lỗi ra ngoài (vòng poll không cần bắt), có ghi log
await bai('đẩy tồn lỗi → chỉ ghi log, không ném lỗi ra ngoài', { stockLoi: true },
  ({ loi, goi }) => loi === null && goi.some(g => g.startsWith('LOG:') && g.includes('Gateway Timeout')));
// 3. Vét phiếu hỏng → KHÔNG được đóng dấu "đã vét hôm nay" → vòng sau vét lại eod
await bai('vét phiếu hỏng → chưa đóng dấu, vòng sau vét lại eod', { slipsLoi: true },
  ({ st, goi }) => st.sweptToday === '' && goi.includes('slips:eod'));
// 4. Vét thành công → đóng dấu; vòng sau không vét nữa (không gửi lặp)
await bai('vét xong → đóng dấu hôm nay; gọi lần 2 không vét lại', {},
  ({ st }) => st.sweptToday === '2026-09-14');
{
  const { h, goi } = dung({});
  await h.run(); await h.run();
  const ok = goi.filter(g => g === 'slips:eod').length === 1 && goi.filter(g => g === 'slips:null').length === 1;
  console.log(`${ok ? '✅' : '❌'} gọi 2 lần liên tiếp lúc 16:30 → chỉ 1 lần eod, lần 2 là vòng thường\n     gọi: ${goi.join(' → ')}`);
  ok ? dat++ : hong++;
}
// 5. Vét khởi động cũng theo luật đó: hỏng thì lần sau vét start lại
await bai('vét khởi động hỏng → lần sau vẫn là start', { daKhoiDong: false, slipsLoi: true, gio: '09:00' },
  ({ st, goi }) => st.sweepOnStartDone === false && goi.includes('slips:start'));
// 6. Giờ thường (trước 16:30) → không vét, chỉ vòng thường
await bai('09:00 giờ thường → sweep=null, không đóng dấu', { gio: '09:00' },
  ({ st, goi }) => goi.includes('slips:null') && st.sweptToday === '');

console.log(`\nKẾT QUẢ: ${dat} đạt · ${hong} hỏng · file: ${FILE}`);
process.exit(hong ? 1 : 0);
