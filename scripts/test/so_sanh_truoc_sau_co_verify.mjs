// SO SÁNH TRƯỚC / SAU khi xây bộ phận CO (anh Hữu yêu cầu rà 06/10/2026).
// Chạy 2 bản app tăng ca CÙNG nối Supabase thật: bản cũ 24aa022 (25/09, trước CO) ở BASE_OLD và bản hiện tại ở BASE_NEW.
// Với mỗi vai trò (admin · qlsx · tổ trưởng HD/RL · nhân viên HD/RL) gọi CÙNG các trang/API CHỈ ĐỌC (GET) rồi so:
//   - API: JSON phải GIỐNG HỆT (khác = in ra để xét: CO hợp lệ hay lỗi)
//   - Trang: danh sách nút tab + mã trạng thái phải giống
// Phiên đăng nhập ký cục bộ bằng JWT_SECRET (.env.local), token chỉ gửi tới localhost, KHÔNG in ra. Không ghi gì.
//   node scripts/test/so_sanh_truoc_sau_co_verify.mjs http://localhost:3021 http://localhost:3022
import fs from 'node:fs';
import { SignJWT } from 'jose';

const [BASE_OLD = 'http://localhost:3021', BASE_NEW = 'http://localhost:3022'] = process.argv.slice(2);
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));
const agentEnv = Object.fromEntries(fs.readFileSync('print-agent/.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const secret = new TextEncoder().encode(env.JWT_SECRET);
const SB = env.NEXT_PUBLIC_SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY;

const vn = new Date(Date.now() + 7 * 3600_000).toISOString();
const TODAY = vn.slice(0, 10), MONTH = vn.slice(0, 7);
const YDAY = new Date(Date.now() + 7 * 3600_000 - 86400_000).toISOString().slice(0, 10);

let P = 0, F = 0, W = 0;
const ok = (m) => { P++; console.log('   ok  ', m); };
const bad = (m, x = '') => { F++; console.log('   SAI ', m, x); };
const warn = (m) => { W++; console.log('   XÉT ', m); };

const users = await (await fetch(`${SB}/rest/v1/users?select=id,username,full_name,role,department,active&order=username`,
  { headers: { apikey: SK, Authorization: `Bearer ${SK}` } })).json();
const pick = (role, dept) => users.find((u) => u.role === role && (dept === undefined || u.department === dept) && u.active !== false);
const ROLES = [
  ['admin', pick('admin')], ['qlsx', pick('qlsx')],
  ['tổ trưởng HD', pick('leader', 'HD')], ['tổ trưởng RL', pick('leader', 'RL')],
  ['nhân viên HD', pick('worker', 'HD')], ['nhân viên RL', pick('worker', 'RL')],
];
async function tokenOf(u) {
  return new SignJWT({ userId: u.id, username: u.username, fullName: u.full_name, role: u.role, department: u.department })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

// Bỏ trường thời gian sinh lúc gọi (không phải dữ liệu) trước khi so
const VOLATILE = new Set(['generated_at', 'now', 'server_time', 'fetched_at']);
const norm = (v) => Array.isArray(v) ? v.map(norm) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().filter((k) => !VOLATILE.has(k)).map((k) => [k, norm(v[k])])) : v;
function firstDiff(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return `${path || '/'}: ${JSON.stringify(a)?.slice(0, 120)} → ${JSON.stringify(b)?.slice(0, 120)}`;
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return `${path}[] độ dài ${a.length} → ${b.length}`;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) return `${path}.${k}: (mới có) ${JSON.stringify(b[k])?.slice(0, 120)}`;
    if (!(k in b)) return `${path}.${k}: (mất) ${JSON.stringify(a[k])?.slice(0, 120)}`;
    const d = firstDiff(a[k], b[k], `${path}.${k}`); if (d) return d;
  }
  return null;
}
async function call(base, path, cookie, extraHeaders = {}) {
  const r = await fetch(base + path, { headers: { cookie, ...extraHeaders }, redirect: 'manual' });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* trang HTML */ }
  return { s: r.status, text, json, loc: r.headers.get('location') };
}
const tabsOf = (html) => [...html.matchAll(/<button[^>]*>([^<]{2,40})<\/button>/g)].map((m) => m[1].trim())
  .filter((t) => /tăng ca|Tem NVL|Kế hoạch|Máy dừng|Xuất kho|Trả kho|DCCD|Sản lượng/i.test(t));

const API = (role) => [
  `/api/registrations/department?date=${TODAY}`, `/api/registrations/department?date=${YDAY}`,
  `/api/registrations/summary?month=${MONTH}`, `/api/registrations/today-summary?date=${TODAY}`,
  `/api/registrations/today-summary?date=${YDAY}`, `/api/registrations/mine?date=${TODAY}`,
  `/api/registrations/by-date?date=${TODAY}`, `/api/register/options?date=${TODAY}`,
  '/api/khsx', '/api/dccd-lots', '/api/plan-files', `/api/stop-reasons?date=${TODAY}`, `/api/stop-reasons?date=${YDAY}&all=1`,
  `/api/labels?date=${TODAY}`, `/api/labels?date=${YDAY}`, '/api/nvl-stock?meta=1',
  `/api/nvl-slips?kind=issue&branch=nvl&date=${TODAY}`, `/api/nvl-slips?kind=return&branch=nvl&date=${TODAY}`,
  `/api/nvl-slips?kind=issue&branch=aux&date=${TODAY}`, `/api/nvl-slips?kind=issue&branch=nvl&date=${YDAY}`,
  '/api/nvl-temp?branch=nvl', '/api/nvl-temp?branch=aux', '/api/print-jobs/mine',
  ...(role === 'admin' ? ['/api/users', '/api/print-jobs?status=done'] : []),
];
const PAGES = (role) => role === 'admin'
  ? ['/dashboard', '/dashboard/qlsx', '/dashboard/users', '/dashboard/stop-reasons', '/dashboard/upload', `/print/overtime-summary?month=${MONTH}`, `/print/labels?date=${YDAY}`]
  : ['/register', `/print/overtime-summary?month=${MONTH}`];

// Khác biệt ĐƯỢC PHÉP (do chính tính năng CO/khác đã duyệt): ghi rõ lý do
const ALLOWED = [
  { re: /^\.departments\.CO: \(mới có\) \[\]$/, why: 'khối Coating rỗng (CO=[]), màn Tăng ca hôm nay chỉ hiện cho admin/qlsx — đã duyệt 05/10' },
];

for (const [label, u] of ROLES) {
  console.log(`\n== ${label}: ${u ? `${u.username} (${u.role}/${u.department ?? '-'})` : 'KHÔNG CÓ TÀI KHOẢN'}`);
  if (!u) { warn(`không có tài khoản ${label} để thử`); continue; }
  const cookie = `session=${await tokenOf(u)}`;
  for (const path of PAGES(u.role)) {
    const [a, b] = [await call(BASE_OLD, path, cookie), await call(BASE_NEW, path, cookie)];
    if (a.s !== b.s) { bad(`trang ${path}: mã ${a.s} → ${b.s}`); continue; }
    const ta = tabsOf(a.text), tb = tabsOf(b.text);
    if (JSON.stringify(ta) === JSON.stringify(tb)) ok(`trang ${path} ${b.s} · tab giống: ${tb.join(' | ') || '(không có tab)'}`);
    else bad(`trang ${path} tab khác`, `\n         cũ: ${ta.join(' | ')}\n         mới: ${tb.join(' | ')}`);
  }
  for (const path of API(u.role)) {
    const [a, b] = [await call(BASE_OLD, path, cookie), await call(BASE_NEW, path, cookie)];
    if (a.s !== b.s) { bad(`${path}: mã ${a.s} → ${b.s}`, b.text.slice(0, 150)); continue; }
    if (!a.json || !b.json) { (a.text === b.text ? ok : bad)(`${path} ${b.s} (không phải JSON)`); continue; }
    const d = firstDiff(norm(a.json), norm(b.json));
    if (!d) { ok(`${path} ${b.s} · JSON giống hệt (${b.text.length} byte)`); continue; }
    const al = ALLOWED.find((x) => x.re.test(d));
    if (al) warn(`${path}: khác — ${al.why}: ${d}`); else bad(`${path}: JSON khác`, d);
  }
}

// Agent (Bearer AGENT_SECRET) — 2 API agent kéo dữ liệu tăng ca / phiếu kho sang app chính
console.log('\n== agent (Bearer)');
for (const path of ['/api/overtime-export?meta=1', `/api/overtime-export`]) {
  const H = { authorization: `Bearer ${agentEnv.AGENT_SECRET}` };
  const [a, b] = [await call(BASE_OLD, path, '', H), await call(BASE_NEW, path, '', H)];
  if (a.s !== b.s) { bad(`${path}: mã ${a.s} → ${b.s}`); continue; }
  const d = a.json && b.json ? firstDiff(norm(a.json), norm(b.json)) : (a.text === b.text ? null : 'khác văn bản');
  if (!d) ok(`${path} ${b.s} · giống hệt (${b.text.length} byte)`);
  else (ALLOWED.find((x) => x.re.test(d)) ? warn : bad)(`${path}: ${d}`);
}

console.log(`\n${F === 0 ? 'PASS' : 'FAIL'} — ${P} giống · ${W} khác do CO (xét tay) · ${F} sai`);
process.exit(F ? 1 : 0);
