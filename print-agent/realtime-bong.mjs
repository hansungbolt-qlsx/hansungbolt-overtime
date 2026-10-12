// GĐ2 — CHẠY BÓNG Realtime (12/10/2026, docs/realtime-agent-thiet-ke.md mục 6).
// CHỈ NGHE tin lệnh in mới — KHÔNG nhận, KHÔNG in, KHÔNG đổi lệnh nào. Agent thật (agent.js) vẫn chạy y như cũ.
// Ghi mỗi tin vào realtime-bong.jsonl để doi-chieu-bong.mjs so với print_jobs thật (đủ 100 % chưa, trễ bao nhiêu).
// Ghi duy nhất vào Supabase: dòng agent_heartbeat id='bong' (canary 10 phút/lần).
import 'dotenv/config';
import { appendFileSync, writeFileSync } from 'node:fs';
import { taoHub } from './realtime-hub.mjs';

const TIN = new URL('./realtime-bong.jsonl', import.meta.url);
const TRANG_THAI = new URL('./realtime-bong-trangthai.json', import.meta.url);
const ghi = (m) => console.log(m);

const hub = taoHub({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY, idAgent: 'bong', ghiLog: ghi });

hub.dangKy({
  bang: 'print_jobs',
  suKien: 'INSERT',
  xuLy: (p) => {
    const n = p.new || {};
    const tre = n.created_at ? Date.now() - Date.parse(n.created_at) : null;
    appendFileSync(TIN, JSON.stringify({ nhan_luc: new Date().toISOString(), id: n.id, type: n.type,
      status: n.status, created_at: n.created_at, tre_ms: tre }) + '\n');
    ghi(`[${new Date().toISOString()}] [bóng] tin lệnh in ${String(n.id).slice(0, 8)} type=${n.type} trễ ${tre} ms`);
  },
  batBu: (lyDo) => ghi(`[${new Date().toISOString()}] [bóng] (bắt bù: ${lyDo} — chế độ bóng chỉ ghi nhận, không xử lý)`),
});

const luuTrangThai = () => {
  const s = { cap_nhat: new Date().toISOString(), ...hub.trangThai() };
  writeFileSync(TRANG_THAI, JSON.stringify(s, null, 1));
  if (!s.khoe) ghi(`[${s.cap_nhat}] [bóng] KHÔNG KHOẺ: ${s.lyDo}`);
};
setInterval(luuTrangThai, 60_000);
await hub.batDau();
ghi(`[${new Date().toISOString()}] [bóng] bắt đầu chạy bóng — chỉ nghe print_jobs INSERT`);
