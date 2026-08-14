/**
 * Bật `next dev` tạm, chạy MỘT bài kiểm, rồi tắt máy chủ.
 * Dùng khi không bật được tiến trình nền riêng.
 *   node scripts/test/chay_kiem_chot_phien_ban.mjs [duong/dan/bai-kiem.mjs]
 * Không truyền gì thì chạy bài chốt phiên bản (mặc định cũ).
 */
import { spawn } from 'node:child_process';
import { setTimeout as ngu } from 'node:timers/promises';

const CONG = 3210;
const GOC = `http://127.0.0.1:${CONG}`;

/** Windows: kill() chỉ giết vỏ shell, `next dev` thật sống tiếp và giữ cổng →
 *  lần chạy sau có HAI máy chủ chồng nhau trên cùng cổng (đã dính 13/08).
 *  Phải giết CẢ CÂY tiến trình bằng taskkill /T /F. */
function tatHan(pid) {
  if (process.platform !== 'win32') { try { process.kill(-pid); } catch { /* */ } return; }
  try { spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* */ }
}

console.log('Đang bật next dev…');
const sv = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx',
                 ['next', 'dev', '-p', String(CONG)],
                 { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
let log = '';
sv.stdout.on('data', (b) => { log += b; });
sv.stderr.on('data', (b) => { log += b; });

let san = false;
for (let i = 0; i < 90; i += 1) {
  await ngu(2000);
  try {
    const r = await fetch(`${GOC}/api/nvl-slips?kind=issue&branch=nvl`);
    if (r.status === 401 || r.status === 200) { san = true; break; }
  } catch { /* chưa lên */ }
}
if (!san) {
  console.log('🛑 Máy chủ không lên sau 180 giây. Nhật ký:\n', log.slice(-2500));
  tatHan(sv.pid);
  process.exit(1);
}
console.log(`Máy chủ đã lên ở ${GOC}\n`);

const BAI = process.argv[2] || 'scripts/test/chot_phien_ban_verify.mjs';
const kt = spawn(process.execPath, [BAI, GOC], { stdio: 'inherit' });
const ma = await new Promise((res) => kt.on('exit', res));

console.log('\nTắt máy chủ…');
// ⚠ PHẢI là tatHan(), KHÔNG phải sv.kill(): trên Windows `sv` chỉ là vỏ shell,
// giết nó thì `next dev` thật sống tiếp và giữ cổng 3210 → lần chạy sau có hai
// máy chủ chồng nhau, bài kiểm treo. Đường LỖI ở trên đã dùng đúng từ 13/08,
// nhưng đường THÀNH CÔNG này vẫn sót lại — sửa 14/08/2026.
tatHan(sv.pid);
await ngu(1500);
process.exit(ma ?? 1);
