// Kiểm THẬT bộ phận CO trên app chạy cục bộ (nối Supabase THẬT) — anh Hữu 05/10/2026.
// Chạy:  node scripts/test/coating_dept_live_verify.mjs [http://127.0.0.1:3011]
// - Đăng nhập admin (tài khoản agent trong print-agent/.env, KHÔNG in ra) → tạo 4 tài khoản CO nếu chưa có
//   (đây là tài khoản THẬT anh dùng, không xoá).
// - Đăng nhập tổ trưởng CO: trang chủ 3 tab, máy CO, ĐĂNG KÝ THỬ 1 phiếu (RPM tay) → kiểm summary/today/export/PATCH → XOÁ phiếu thử.
// - Đăng nhập nhân viên CO: 2 tab, không đăng ký được.
// - DCCD: tổ trưởng CO bị chặn công đoạn 10 (403). KHÔNG tạo lệnh in thật (agent sẽ in).
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:3011';
let ok = 0, bad = 0;
const ck = (c, msg, extra = '') => { if (c) { ok++; console.log('   ok ', msg); } else { bad++; console.log('   SAI', msg, extra); } };

const env = Object.fromEntries(readFileSync('print-agent/.env', 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

class Client {
  constructor() { this.cookie = ''; }
  async req(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (this.cookie) headers.cookie = this.cookie;
    const res = await fetch(BASE + path, { ...opts, headers, redirect: 'manual' });
    const sc = res.headers.getSetCookie?.() ?? [];
    if (sc.length) this.cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return res;
  }
  async json(path, opts = {}) {
    const res = await this.req(path, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
    let body = null; try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
  }
  async login(u, p) {
    const r = await this.json('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    return r;
  }
}

const CO_USERS = [
  ['NGUYỄN ĐỨC HIẾU', 'nguyenduchieu', 'leader'],
  ['NGUYỄN CHÍ HIẾU', 'nguyenchihieu', 'worker'],
  ['NGUYỄN CHÍ TRUNG', 'nguyenchitrung', 'worker'],
  ['ĐỖ ĐĂNG THẮNG', 'dodangthang', 'worker'],
];
const today = new Date(); const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

console.log('A. Admin tạo tài khoản CO');
const admin = new Client();
const la = await admin.login(env.LOGIN_USERNAME, env.LOGIN_PASSWORD);
ck(la.status === 200 && la.body?.role === 'admin', 'đăng nhập admin', JSON.stringify(la.body));
const before = await admin.json('/api/users');
const have = new Set((before.body?.users ?? []).map((u) => u.username));
for (const [fn, un, role] of CO_USERS) {
  if (have.has(un)) { ck(true, `tài khoản ${un} đã có`); continue; }
  const r = await admin.json('/api/users', { method: 'POST', body: JSON.stringify({ full_name: fn, username: un, role, department: 'CO' }) });
  ck(r.status === 200 && r.body?.user?.department === 'CO' && r.body?.user?.role === role, `tạo ${un} (${role}, CO)`, JSON.stringify(r.body));
}
const bad1 = await admin.json('/api/users', { method: 'POST', body: JSON.stringify({ full_name: 'X', username: 'xtestco', role: 'worker', department: 'XX' }) });
ck(bad1.status === 400, 'bộ phận lạ bị chặn 400', String(bad1.status));
const after = await admin.json('/api/users');
const coUsers = (after.body?.users ?? []).filter((u) => u.department === 'CO');
ck(coUsers.length === 4 && coUsers.filter((u) => u.role === 'leader').length === 1, '4 tài khoản CO, 1 tổ trưởng', JSON.stringify(coUsers.map((u) => [u.username, u.role])));

console.log('B. Tổ trưởng CO');
const ld = new Client();
const ll = await ld.login('nguyenduchieu', 'hd123');
ck(ll.status === 200 && ll.body?.redirect === '/register', 'đăng nhập nguyenduchieu/hd123 → /register', JSON.stringify(ll.body));
const home = await ld.req('/register'); const html = await home.text();
ck(home.status === 200 && /Bộ phận (?:<!-- -->)?CO</.test(html), 'trang chủ hiện Bộ phận CO');
for (const t of ['Đăng ký tăng ca', 'Tăng ca hôm nay', 'Kế hoạch SX']) ck(html.includes(t), `tab "${t}" có`);
for (const t of ['Máy dừng hôm nay', 'Tem NVL', 'Xuất kho']) ck(!html.includes(`>${t}<`), `tab "${t}" KHÔNG có`);
const opts = await ld.json(`/api/register/options?date=${ymd}`);
const mcs = (opts.body?.machines ?? []).map((m) => m.code);
ck(opts.status === 200 && JSON.stringify(mcs) === JSON.stringify(['CO-01', 'CO-02', 'CO-03']), 'máy khả dụng = CO-01..03', JSON.stringify(mcs));
ck((opts.body?.employees ?? []).length === 4 && opts.body.employees[0].full_name === 'NGUYỄN ĐỨC HIẾU', 'danh sách NV = 4 người CO, Hiếu đứng đầu');
const m1 = (opts.body?.machines ?? [])[0]; const e1 = (opts.body?.employees ?? [])[0];
// Đăng ký thử: RPM tay 120 → SL dự kiến = 120 × 60 × 2.5 = 18.000 (ngày thường)
const reg = await ld.json('/api/registrations', { method: 'POST', body: JSON.stringify({
  overtime_date: ymd, day_type: 'weekday',
  items: [{ employee_id: e1.id, equipment_id: m1.id, item_code: 'TEST-CO-XOA', item_name: null, planned_quantity: 120 * 60 * 2.5 }],
}) });
ck(reg.status === 200 && reg.body?.id, 'đăng ký thử 1 phiếu CO', JSON.stringify(reg.body));
const regId = reg.body?.id;
try {
  const ts = await ld.json(`/api/registrations/today-summary?date=${ymd}`);
  const coRows = ts.body?.departments?.CO ?? [];
  ck(ts.status === 200 && ts.body?.restrictDept === 'CO' && coRows.length === 1 && coRows[0].machines[0].code === 'CO-01', 'Tăng ca hôm nay: chỉ CO, có CO-01', JSON.stringify(ts.body?.departments));
  ck((ts.body?.departments?.HD ?? []).length === 0 && (ts.body?.departments?.RL ?? []).length === 0, 'không thấy HD/RL');
  const sm = await ld.json(`/api/registrations/summary?month=${ymd.slice(0, 7)}`);
  const smRows = sm.body?.summary ?? sm.body?.rows ?? [];
  const depts = new Set((Array.isArray(smRows) ? smRows : []).map((r) => r.employee_department));
  ck(sm.status === 200 && depts.size >= 1 && [...depts].every((d) => d === 'CO'), 'Tổng hợp tháng: chỉ bộ phận CO', JSON.stringify([...depts]));
  const dl = await ld.json(`/api/registrations/department?date=${ymd}`);
  const dlist = dl.body?.registrations ?? dl.body ?? [];
  ck(dl.status === 200 && JSON.stringify(dl.body).includes(regId), 'danh sách phiếu bộ phận có phiếu thử');
  const ex = await ld.req(`/api/export/${regId}`);
  const buf = Buffer.from(await ex.arrayBuffer());
  ck(ex.status === 200 && buf.slice(0, 2).toString() === 'PK' && buf.length > 30000, `export Excel phiếu CO ok (${buf.length} byte, cỡ như HD/RL ~41 KB)`, String(ex.status));
  // PATCH với rpm tay 200 → SL dự kiến 200×60×2.5 = 30.000
  const pt = await ld.json(`/api/registrations/${regId}`, { method: 'PATCH', body: JSON.stringify({ day_type: 'weekday',
    items: [{ employee_id: e1.id, equipment_id: m1.id, item_code: 'TEST-CO-XOA', rpm: 200 }] }) });
  ck(pt.status === 200, 'PATCH phiếu với rpm tay', JSON.stringify(pt.body));
  // kiểm planned_quantity qua Supabase REST (service key của agent)
  const sb = await fetch(`${env.SUPABASE_URL}/rest/v1/overtime_items?registration_id=eq.${regId}&select=planned_quantity,item_code`, { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  const items = await sb.json();
  ck(Array.isArray(items) && items.length === 1 && items[0].planned_quantity === 30000, 'SL dự kiến = 200 × 60 × 2,5 = 30.000', JSON.stringify(items));
  // DCCD: công đoạn 10 bị chặn với tổ trưởng CO
  const pj = await ld.json('/api/print-jobs', { method: 'POST', body: JSON.stringify({ type: 'dccd', ref_id: '202609001|10|1' }) });
  ck(pj.status === 403, 'tổ trưởng CO in DCCD công đoạn 10 → 403', String(pj.status) + ' ' + JSON.stringify(pj.body));
  const pk = await ld.json('/api/print-jobs', { method: 'POST', body: JSON.stringify({ type: 'khsx_tong', ref_id: 'x' }) });
  ck(pk.status === 403 || pk.status === 400, 'tổ trưởng CO không in sheet KHSX', String(pk.status));
} finally {
  if (regId) {
    const del = await ld.json(`/api/registrations/${regId}`, { method: 'DELETE' });
    ck(del.status === 200, 'XOÁ phiếu thử', String(del.status) + ' ' + JSON.stringify(del.body));
  }
}

console.log('C. Nhân viên CO');
const wk = new Client();
const lw = await wk.login('nguyenchihieu', 'hd123');
ck(lw.status === 200, 'đăng nhập nguyenchihieu/hd123');
const h2 = await (await wk.req('/register')).text();
for (const t of ['Tổng hợp tăng ca', 'Tăng ca hôm nay']) ck(h2.includes(t), `worker: tab "${t}" có`);
for (const t of ['Đăng ký tăng ca', 'Kế hoạch SX', 'Máy dừng hôm nay', 'Tem NVL']) ck(!h2.includes(`>${t}<`), `worker: tab "${t}" KHÔNG có`);
const wreg = await wk.json('/api/registrations', { method: 'POST', body: JSON.stringify({ overtime_date: ymd, day_type: 'weekday', items: [] }) });
ck(wreg.status === 401 || wreg.status === 403, 'worker không đăng ký được', String(wreg.status));

console.log(`\n${bad === 0 ? 'PASS' : 'FAIL'} — ${ok} ok · ${bad} sai`);
process.exit(bad ? 1 : 0);
