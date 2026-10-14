// GIÁM SÁT REALTIME sau khi bật REALTIME_ON (anh Hữu 14/10/2026) — CHỈ ĐỌC Supabase.
// Task Scheduler chạy mỗi 15 phút. Mỗi lần:
//   1. Mọi lệnh in tạo từ lúc bật: trễ nhận = started_at − created_at.
//        ≤ 5 giây = Realtime đẩy tin · 5–20 giây = nghi (vòng chờ 10 giây) · > 20 giây = LỠ TIN (lưới 60 giây vớt)
//      Lệnh pending/claimed quá 2 phút = KẸT.
//   2. Sức khoẻ kênh: realtime-trangthai.json (agent ghi mỗi phút) — cũ > 5 phút hoặc khoe=false = hỏng.
//   3. Nhịp gọi Supabase của agent (dem-luot-goi.json) giữa 2 lần chạy → lượt/giờ.
// Ghi 1 dòng vào giam-sat-realtime.log; có LỠ / KẸT / hỏng → nhắn Telegram (mỗi sự việc 1 lần).
//   node giam-sat-realtime.mjs            → chạy 1 lượt (task gọi)
//   node giam-sat-realtime.mjs --bao-cao  → in bảng tổng từ lúc bật + mốc so sánh 7 ngày trước khi bật
import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';

const BAT_LUC = '2026-10-14T01:59:23Z';            // giờ kênh SUBSCRIBED sau khi bật REALTIME_ON
const DIR = new URL('./', import.meta.url);
const f = (n) => new URL(n, DIR);
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const now = new Date();

async function jobs(tu, den) {
  const q = `created_at=gte.${tu}` + (den ? `&created_at=lt.${den}` : '');
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/print_jobs?${q}&select=id,type,status,created_at,started_at&order=created_at.asc`, { headers: H });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}
const treS = (j) => (j.started_at ? (new Date(j.started_at) - new Date(j.created_at)) / 1000 : null);
function phanLoai(ds) {
  const o = { tong: ds.length, rt: 0, nghi: 0, lo: [], ket: [], tre: [] };
  for (const j of ds) {
    const t = treS(j);
    if (t === null) {
      if (['pending', 'claimed', 'printing'].includes(j.status) && now - new Date(j.created_at) > 120_000) o.ket.push(j);
      continue;
    }
    o.tre.push(t);
    if (t <= 5) o.rt++; else if (t <= 20) o.nghi++; else o.lo.push({ ...j, tre: t });
  }
  o.tre.sort((a, b) => a - b);
  o.trungVi = o.tre.length ? o.tre[Math.floor(o.tre.length / 2)] : null;
  o.lonNhat = o.tre.length ? o.tre[o.tre.length - 1] : null;
  return o;
}
async function telegram(text) {
  try {
    const cfg = JSON.parse(readFileSync('F:/0. Quản lý nguyên liệu/telegram-bot/bot.cfg', 'utf8'));
    await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.allowed_chat_id, text }),
    });
  } catch { /* nhắn hỏng không làm hỏng giám sát */ }
}

const o = phanLoai(await jobs(BAT_LUC));

if (process.argv.includes('--bao-cao')) {
  const truoc = phanLoai(await jobs(new Date(Date.parse(BAT_LUC) - 7 * 86400_000).toISOString(), BAT_LUC));
  const dong = (ten, x) => console.log(`${ten}: ${x.tong} lệnh · ≤5s ${x.rt} · 5–20s ${x.nghi} · >20s ${x.lo.length} · kẹt ${x.ket.length} · trễ trung vị ${x.trungVi ?? '-'}s · lớn nhất ${x.lonNhat ?? '-'}s`);
  dong('7 ngày TRƯỚC khi bật (hỏi 10 giây)', truoc);
  dong(`TỪ LÚC BẬT ${BAT_LUC}`, o);
  for (const j of o.lo) console.log(`  >20s ${j.id.slice(0, 8)} ${j.type} ${j.created_at} trễ ${j.tre}s`);
  for (const j of o.ket) console.log(`  KẸT ${j.id.slice(0, 8)} ${j.type} ${j.created_at} ${j.status}`);
  process.exit(0);
}

// sức khoẻ kênh
let kenh = 'không có file', kenhHong = true;
if (existsSync(f('realtime-trangthai.json'))) {
  const s = JSON.parse(readFileSync(f('realtime-trangthai.json'), 'utf8'));
  const cuPhut = (now - new Date(s.cap_nhat)) / 60_000;
  kenhHong = !s.khoe || cuPhut > 5 || s.canaryOk === false;
  kenh = `${s.khoe ? 'khoẻ' : 'KHÔNG KHOẺ ' + (s.lyDo || '')} · nối lại ${s.lanNoiLai} · canary ${s.canaryOk === null ? 'chưa chạy' : s.canaryOk ? s.canaryMs + 'ms' : 'HỎNG'} · cập nhật ${cuPhut.toFixed(1)}′ trước`;
}
// nhịp gọi Supabase
const st = existsSync(f('giam-sat-realtime-trangthai.json')) ? JSON.parse(readFileSync(f('giam-sat-realtime-trangthai.json'), 'utf8')) : { daBao: [] };
let nhip = '';
try {
  const d = JSON.parse(readFileSync(f('dem-luot-goi.json'), 'utf8'));
  if (st.dem && st.dem.ngay === d.ngay && d.supabase_ngay >= st.dem.sb) {
    const gio = (new Date(d.cap_nhat) - new Date(st.dem.luc)) / 3600_000;
    if (gio > 0.1) nhip = ` · Supabase ${Math.round((d.supabase_ngay - st.dem.sb) / gio)} lượt/giờ`;
  }
  st.dem = { ngay: d.ngay, sb: d.supabase_ngay, luc: d.cap_nhat };
} catch { /* bỏ qua */ }

const dong = `[${now.toISOString()}] ${o.tong} lệnh từ lúc bật · ≤5s ${o.rt} · 5–20s ${o.nghi} · >20s ${o.lo.length} · kẹt ${o.ket.length}`
  + (o.tre.length ? ` · trễ TV ${o.trungVi}s max ${o.lonNhat}s` : '') + ` · kênh: ${kenh}${nhip}`;
appendFileSync(f('giam-sat-realtime.log'), dong + '\n');
console.log(dong);

const viec = [
  ...o.lo.map((j) => [`lo:${j.id}`, `lệnh in ${j.type} ${j.id.slice(0, 8)} nhận trễ ${j.tre}s (Realtime lỡ tin, lưới dự phòng vớt)`]),
  ...o.ket.map((j) => [`ket:${j.id}`, `lệnh in ${j.type} ${j.id.slice(0, 8)} KẸT ${j.status} quá 2 phút`]),
  ...(kenhHong ? [[`kenh:${now.toISOString().slice(0, 13)}`, `kênh Realtime: ${kenh}`]] : []),
].filter(([k]) => !st.daBao.includes(k));
if (viec.length) {
  await telegram('⚠ Giám sát Realtime agent in:\n' + viec.map(([, t]) => '• ' + t).join('\n')
    + '\nTắt nhanh: xoá dòng REALTIME_ON=1 trong print-agent/.env rồi khởi động lại agent.');
  st.daBao.push(...viec.map(([k]) => k));
}
writeFileSync(f('giam-sat-realtime-trangthai.json'), JSON.stringify(st, null, 1));
