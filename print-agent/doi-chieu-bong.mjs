// Đối chiếu kết quả CHẠY BÓNG (GĐ2) với lệnh in thật — CHỈ ĐỌC Supabase.
//   node doi-chieu-bong.mjs            → từ lúc tin đầu tiên / file trạng thái
//   node doi-chieu-bong.mjs <ISO>      → từ mốc giờ cho trước
// Qua cửa GĐ2: 100 % lệnh in tạo ra trong lúc bóng KHOẺ đều có tin · trễ trung vị < 2 giây.
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';

const f = new URL('./realtime-bong.jsonl', import.meta.url);
const tin = existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const tu = process.argv[2] || process.env.BONG_TU;
if (!tu) { console.log('Cần mốc bắt đầu: node doi-chieu-bong.mjs 2026-10-12T05:00:00Z'); process.exit(1); }
const H = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` };
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/print_jobs?created_at=gte.${tu}&select=id,type,status,created_at&order=created_at.asc`, { headers: H });
const jobs = await r.json();
const daNhan = new Map(tin.map((t) => [t.id, t]));
const lo = jobs.filter((j) => !daNhan.has(j.id));
const tre = jobs.map((j) => daNhan.get(j.id)?.tre_ms).filter((x) => typeof x === 'number').sort((a, b) => a - b);
const tv = tre.length ? tre[Math.floor(tre.length / 2)] : null;
console.log(`Từ ${tu}: ${jobs.length} lệnh in thật · bóng nhận ${jobs.length - lo.length} · LỠ ${lo.length}`);
console.log(`Trễ (ms): trung vị ${tv} · lớn nhất ${tre.length ? tre[tre.length - 1] : null}`);
for (const j of lo) console.log(`  LỠ ${j.id.slice(0, 8)} ${j.type} ${j.created_at} ${j.status}`);
if (existsSync(new URL('./realtime-bong-trangthai.json', import.meta.url))) {
  console.log('Trạng thái bóng:', readFileSync(new URL('./realtime-bong-trangthai.json', import.meta.url), 'utf8').replace(/\s+/g, ' ').slice(0, 400));
}
console.log(lo.length === 0 ? 'ĐẠT (0 lệnh lỡ)' : 'CHƯA ĐẠT');
