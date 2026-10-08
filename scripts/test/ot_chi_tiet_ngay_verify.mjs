// Kiểm tab "Chi tiết theo ngày" của thẻ Tổng hợp giờ tăng ca (anh Hữu 08/10/2026) — CHỈ ĐỌC Supabase thật.
// Chạy: node scripts/test/ot_chi_tiet_ngay_verify.mjs [http://127.0.0.1:3011]
// So /api/registrations/summary (by_date, dates) với tính lại độc lập từ Supabase theo luật lib/overtime-hours.ts
// (= trang in): người × ngày lấy MAX, item sửa tay → giờ phiếu → 8h CN / 3h thường.
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:3011';
let ok = 0, bad = 0;
const ck = (c, msg, extra = '') => { if (c) { ok++; console.log('   ok ', msg); } else { bad++; console.log('   SAI', msg, extra); } };
const env = Object.fromEntries(readFileSync('print-agent/.env', 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = async (q) => (await fetch(`${env.SUPABASE_URL}/rest/v1/${q}`, { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } })).json();

async function login(u, p) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }), redirect: 'manual' });
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}
const getJ = async (cookie, path) => (await fetch(BASE + path, { headers: { cookie } })).json();

async function expected(month, dept) {
  const [y, m] = month.split('-').map(Number);
  // ngày cuối tháng theo UTC như Vercel (máy +7 dùng new Date(y, m, 0).toISOString() sẽ lùi 1 ngày)
  const end = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  let q = `overtime_registrations?select=id,overtime_date,day_type,duration_hours,department&overtime_date=gte.${month}-01&overtime_date=lte.${end}`;
  if (dept) q += `&department=eq.${dept}`;
  const regs = await sb(q);
  const items = regs.length ? await sb(`overtime_items?select=employee_id,registration_id,duration_hours&registration_id=in.(${regs.map((r) => r.id).join(',')})`) : [];
  const rm = new Map(regs.map((r) => [r.id, r]));
  const emp = new Map();
  for (const it of items) {
    const r = rm.get(it.registration_id); if (!r) continue;
    const h = Number(it.duration_hours ?? Number(r.duration_hours ?? 0) ?? (r.day_type === 'sunday' ? 8 : 3));
    const mp = emp.get(it.employee_id) ?? new Map(); emp.set(it.employee_id, mp);
    if (h > (mp.get(r.overtime_date) ?? 0)) mp.set(r.overtime_date, h);
  }
  return { dates: [...new Set(regs.map((r) => r.overtime_date))].sort(), emp };
}

async function run(label, cookie, month, dept) {
  console.log(`\n${label} · tháng ${month}${dept ? ' · lọc ' + dept : ''}`);
  const j = await getJ(cookie, `/api/registrations/summary?month=${month}`);
  const ex = await expected(month, dept);
  ck(JSON.stringify(j.dates.map((d) => d.date)) === JSON.stringify(ex.dates), `cột ngày = ${ex.dates.length} ngày có phiếu`, JSON.stringify(j.dates.map((d) => d.date)));
  ck(j.summary.length === ex.emp.size, `số người = ${ex.emp.size}`, j.summary.length);
  let cells = 0, diff = 0;
  for (const r of j.summary) {
    const e = ex.emp.get(r.employee_id) ?? new Map();
    const keys = new Set([...Object.keys(r.by_date), ...e.keys()]);
    for (const k of keys) { cells++; if ((r.by_date[k] ?? 0) !== (e.get(k) ?? 0)) { diff++; console.log('      lệch', r.employee_name, k, r.by_date[k], e.get(k)); } }
    const s = Object.values(r.by_date).reduce((a, b) => a + b, 0);
    if (Number(s.toFixed(2)) !== r.total_hours) { diff++; console.log('      tổng lệch', r.employee_name, s, r.total_hours); }
    const sunDays = new Set(j.dates.filter((d) => d.day_type === 'sunday').map((d) => d.date));
    if (Object.keys(r.by_date).filter((d) => sunDays.has(d)).length !== r.sunday_count) { diff++; console.log('      CN lệch', r.employee_name); }
  }
  ck(diff === 0, `${cells} ô người×ngày + tổng giờ + số ngày CN khớp, lệch ${diff}`);
  const grand = j.summary.reduce((s, r) => s + Object.values(r.by_date).reduce((a, b) => a + b, 0), 0);
  console.log(`      tổng tháng ${Number(grand.toFixed(2))}h`);
  return j;
}

const adm = await login(env.LOGIN_USERNAME, env.LOGIN_PASSWORD);
for (const mo of ['2026-09', '2026-10']) await run('admin', adm, mo, null);
const co = await login('nguyenduchieu', 'hd123');
const jco = await run('tổ trưởng CO (ảnh anh gửi)', co, '2026-10', 'CO');
for (const r of jco.summary) console.log('      ', r.employee_name, JSON.stringify(r.by_date), r.total_hours + 'h');
console.log(`\n${bad ? 'FAIL' : 'PASS'} — ${ok} ok · ${bad} sai`);
process.exit(bad ? 1 : 0);
