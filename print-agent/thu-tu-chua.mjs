// BÀI KIỂM TỰ CHỮA LỖI của realtime-hub (12/10/2026). Chỉ ghi 2 dòng thử trong agent_heartbeat
// (id 'thu-tu-chua' = canary, 'thu-tu-chua-tin' = tin thử). Không đụng print_jobs hay bảng khác.
//  1. Kết nối → khoẻ → nhận tin thử
//  2. NGẮT kết nối đột ngột (giả lập rớt mạng) → phải tự nối lại + bắt bù + nhận tin lại
//  3. Lỗi IM LẶNG (kết nối sống, tin rơi) → canary hỏng 2 lần → tự TẠO LẠI kết nối → khoẻ lại
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { taoHub } from './realtime-hub.mjs';

const nhatKy = [];
const hub = taoHub({
  url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY, idAgent: 'thu-tu-chua',
  ghiLog: (m) => { nhatKy.push(m); console.log('   ', m); }, canaryMoiMs: 20_000, canaryDauMs: 3_000,
});
let tinNhan = 0, batBu = 0;
hub.dangKy({ bang: 'agent_heartbeat', loc: 'id=eq.thu-tu-chua-tin', xuLy: () => { tinNhan++; }, batBu: () => { batBu++; } });
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const guiTin = () => db.from('agent_heartbeat').upsert({ id: 'thu-tu-chua-tin', last_seen: new Date().toISOString() });
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const doi = async (dk, ms, buoc = 500) => { const t = Date.now(); while (Date.now() - t < ms) { if (dk()) return true; await ngu(buoc); } return dk(); };
let ok = 0, sai = 0;
const ck = (c, m) => { if (c) { ok++; console.log('  ok  ', m); } else { sai++; console.log('  SAI ', m); } };

await hub.batDau();
ck(await doi(() => hub.trangThai().khoe, 40_000), `1a. khoẻ sau khi kết nối (${JSON.stringify(hub.trangThai().lyDo)})`);
ck(batBu === 1, `1b. bắt bù chạy 1 lần lúc sẵn sàng (batBu=${batBu})`);
await guiTin();
ck(await doi(() => tinNhan === 1, 10_000), `1c. nhận tin thử (tinNhan=${tinNhan})`);

console.log('  --- 2. NGẮT kết nối đột ngột');
hub._thuNgatKetNoi();
ck(await doi(() => !hub.trangThai().khoe, 10_000), `2a. phát hiện không khoẻ (${hub.trangThai().lyDo})`);
ck(await doi(() => hub.trangThai().khoe, 60_000), `2b. tự nối lại và khoẻ lại (lần nối lại=${hub.trangThai().lanNoiLai})`);
ck(batBu === 2, `2c. bắt bù chạy lại sau khi nối lại (batBu=${batBu})`);
await guiTin();
ck(await doi(() => tinNhan === 2, 10_000), `2d. nhận tin sau khi nối lại (tinNhan=${tinNhan})`);

console.log('  --- 3. Lỗi IM LẶNG: kết nối vẫn sống nhưng tin bị rơi');
hub._thuBoQuaTin(true);
ck(hub.trangThai().khoe, '3a. đèn vẫn xanh (đúng là lỗi im lặng — nhịp tim không phát hiện được)');
ck(await doi(() => hub.trangThai().lanTaoLaiClient >= 1, 90_000, 1000), `3b. canary hỏng 2 lần → TẠO LẠI kết nối (lần=${hub.trangThai().lanTaoLaiClient})`);
hub._thuBoQuaTin(false);
ck(await doi(() => hub.trangThai().khoe && hub.trangThai().canaryOk === true, 60_000, 1000), `3c. khoẻ lại + canary đạt (${hub.trangThai().lyDo || 'khoẻ'}, canary ${hub.trangThai().canaryMs} ms)`);
ck(batBu >= 3, `3d. bắt bù chạy sau khi tạo lại (batBu=${batBu})`);
await guiTin();
ck(await doi(() => tinNhan === 3, 10_000), `3e. nhận tin sau khi tạo lại (tinNhan=${tinNhan})`);

await hub.dung();
console.log(sai ? `FAIL ${sai} · ok ${ok}` : `PASS ${ok}/${ok}`);
process.exit(sai ? 1 : 0);
