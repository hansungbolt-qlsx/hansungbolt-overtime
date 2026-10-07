// Kiểm Sản lượng AB (CĐ 84) + Tổng hợp sản lượng trên APP TĂNG CA (anh Hữu chốt 06/10/2026).
// Chạy: `npx next dev -p 3011` rồi `node scripts/test/ab_day_live_verify.mjs [base]` — base mặc định http://localhost:3011.
// Ghi THẬT vào Supabase nhưng CHỈ ngày giả 2020-01-01 và xoá sạch cuối bài; KHÔNG bấm Gửi (không đẩy sang app chính).
// Đăng nhập tổ trưởng CO (nguyenduchieu) qua API rồi gắn cookie.
const BASE = process.argv[2] || 'http://localhost:3011';
const D = '2020-01-01';
const TODAY = process.env.CO_TODAY || '';   // ngày thật để kiểm phiếu đang có vẫn hiện (tuỳ chọn)
let P = 0, F = 0;
const ck = (ok, msg, ...x) => { ok ? P++ : F++; console.log(ok ? '   ok  ' : '   SAI ', msg, ...(ok ? [] : x)); };

async function login(u, p) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
  const c = (r.headers.get('set-cookie') || '').split(';')[0];
  return c;
}
const ck_ = await login('nguyenduchieu', 'hd123');
const H = { cookie: ck_, 'content-type': 'application/json' };
const j = async (path, opt = {}) => {
  const r = await fetch(`${BASE}${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  return { s: r.status, b: await r.json().catch(() => ({})) };
};
const L = (k = {}) => ({ machine: 'AB-01', lot_no: '2001010001', lot_label: '200101-0001-TEST', saeji: '202001001',
  item_code: '040120-T12W-6D', item_name: 'ASSY SCREW F/W', weight_kg: 12.5, employee_id: null, note: 'TEST tự động — xoá ngay', matched: false, ...k });

console.log('A. Đăng nhập + tab');
ck(!!ck_, 'đăng nhập tổ trưởng CO');
const html = await (await fetch(`${BASE}/register`, { headers: { cookie: ck_ } })).text();
for (const t of ['Sản lượng CO', 'Sản lượng AB', 'Tổng hợp sản lượng', 'In phiếu DCCD', 'Tổng hợp tăng ca']) ck(html.includes(`>${t}</button>`), `có tab ${t}`);

console.log('B. Phiếu đang có không bị ảnh hưởng');
if (TODAY) {
  const t = await j(`/api/co-days?date=${TODAY}`);
  ck(t.s === 200 && t.b.slip?.stage === '86' && t.b.lines.length >= 1, `phiếu CO ${TODAY} vẫn hiện ở tab CO: ${t.b.lines?.length} dòng`, t.b);
  const t84 = await j(`/api/co-days?date=${TODAY}&stage=84`);
  ck(t84.s === 200 && (t84.b.slip === null || t84.b.slip.stage === '84'), `tab AB ${TODAY} không lẫn phiếu CO`);
}

console.log('C. Thêm / sửa / tách công đoạn');
const g = await j(`/api/co-days?date=${D}&stage=84`);
const emp = g.b.employees?.[0]?.id;
ck(g.s === 200 && JSON.stringify(g.b.machines) === '["AB-01"]' && g.b.slip === null, 'AB: máy AB-01, ngày giả chưa có phiếu', g.b);
ck(!!emp, 'có danh sách nhân viên CO');
let r = await j('/api/co-days', { method: 'POST', body: JSON.stringify({ date: D, stage: '84', line: L({ employee_id: emp, machine: 'CO-01' }) }) });
ck(r.s === 400, 'AB với máy CO-01 → chặn', r);
r = await j('/api/co-days', { method: 'POST', body: JSON.stringify({ date: D, stage: '84', line: L({ employee_id: emp }) }) });
ck(r.s === 200 && r.b.line?.machine === 'AB-01', 'thêm dòng AB', r);
const abLine = r.b.line?.id;
// CO bắt buộc LOT có trong danh sách (07/10/2026) → dùng 1 LOT thật của 080300-FM5L-DS; LOT giả phải bị chặn
const cat86 = (await j('/api/co-lots?stage=86')).b;
const iFM5L = cat86.items.findIndex((x) => x[0] === '080300-FM5L-DS');
const lotFM5L = cat86.lots.find((x) => x[3] === iFM5L)?.[0];
ck(!!lotFM5L, 'danh sách CO có LOT 080300-FM5L-DS', iFM5L);
r = await j('/api/co-days', { method: 'POST', body: JSON.stringify({ date: D, line: L({ employee_id: emp, machine: 'CO-03', item_code: '080300-FM5L-DS', weight_kg: 30, lot_no: '2001010002' }) }) });
ck(r.s === 400 && /Không có LOT này/.test(r.b.error || ''), 'dòng CO LOT giả → 400 Không có LOT này', r);
r = await j('/api/co-days', { method: 'POST', body: JSON.stringify({ date: D, line: L({ employee_id: emp, machine: 'CO-03', item_code: 'X', weight_kg: 30, lot_no: lotFM5L }) }) });
ck(r.s === 200 && r.b.line?.item_code === '080300-FM5L-DS', 'thêm dòng CO cùng ngày (không gửi stage = 86), mã hàng lấy theo LOT', r);
r = await j('/api/co-days', { method: 'POST', body: JSON.stringify({ date: D, line: L({ employee_id: emp, machine: 'AB-01' }) }) });
ck(r.s === 400, 'CO với máy AB-01 → chặn', r);
const g84 = await j(`/api/co-days?date=${D}&stage=84`), g86 = await j(`/api/co-days?date=${D}`);
ck(g84.b.slip?.uid === 'AB-20200101' && g84.b.slip.stage === '84' && g84.b.lines.length === 1, 'phiếu AB-20200101 có 1 dòng', g84.b);
ck(g86.b.slip?.uid === 'CO-20200101' && g86.b.slip.stage === '86' && g86.b.lines.length === 1 && g86.b.lines[0].machine === 'CO-03', 'phiếu CO-20200101 có 1 dòng, tách khỏi AB', g86.b);
r = await j(`/api/co-days/lines/${abLine}`, { method: 'PATCH', body: JSON.stringify({ line: L({ employee_id: emp, weight_kg: 15 }) }) });
const g84b = await j(`/api/co-days?date=${D}&stage=84`);
ck(r.s === 200 && Number(g84b.b.lines[0].weight_kg) === 15, 'sửa dòng AB 12,5 → 15 kg', r, g84b.b.lines);
r = await j(`/api/co-days/lines/${abLine}`, { method: 'PATCH', body: JSON.stringify({ line: L({ employee_id: emp, machine: 'CO-01' }) }) });
ck(r.s === 400, 'sửa dòng AB sang máy CO-01 → chặn');

console.log('D. Tổng hợp sản lượng');
const sm = await j(`/api/co-summary?date=${D}`);
const b86 = sm.b.stages?.find((s) => s.stage === '86'), b84 = sm.b.stages?.find((s) => s.stage === '84');
ck(sm.s === 200 && sm.b.stages.length === 2, '2 khối CO / AB', sm.b);
ck(b86?.items.length === 1 && b86.items[0].item_code === '080300-FM5L-DS' && b86.total_kg === 30, 'khối CO: 080300-FM5L-DS 30 kg', b86);
ck(b84?.items.length === 1 && b84.items[0].item_code === '040120-T12W-6D' && b84.total_kg === 15 && b84.status === 'draft', 'khối AB: 040120-T12W-6D 15 kg, tính cả phiếu chưa Gửi', b84);
for (const it of [b86?.items[0], b84?.items[0]].filter(Boolean)) {
  if (it.g_ea) ck(it.ea === Math.round((it.kg * 1000) / it.g_ea), `EA = kg×1000÷g: ${it.item_code} ${it.kg} kg ÷ ${it.g_ea} g = ${it.ea}`);
  else console.log(`   (chưa có g/EA cho ${it.item_code} — catalog chưa được agent mới đẩy)`);
}
const empty = await j('/api/co-summary?date=2019-12-31');
ck(empty.s === 200 && empty.b.stages.every((s) => s.items.length === 0 && s.status === null), 'ngày không có phiếu → 2 khối trống');

console.log('E. Lệnh in (chỉ kiểm chặn sai, KHÔNG tạo lệnh in thật)');
r = await j('/api/print-jobs', { method: 'POST', body: JSON.stringify({ type: 'co_day', ref_id: `${D}|85` }) });
ck(r.s === 400, 'ref_id công đoạn lạ → 400');
r = await j('/api/print-jobs', { method: 'POST', body: JSON.stringify({ type: 'dccd', ref_id: '202001001|10|1' }) });
ck(r.s === 403, 'CO in DCCD công đoạn 10 → 403');

console.log('F. Dọn');
r = await j(`/api/co-days?date=${D}&stage=84`, { method: 'DELETE' });
ck(r.s === 200 && r.b.main_delete_queued === false, 'xoá phiếu AB ngày giả (chưa từng về app chính)', r);
const still86 = await j(`/api/co-days?date=${D}`);
ck(still86.b.slip?.uid === 'CO-20200101' && still86.b.lines.length === 1, 'xoá AB không đụng phiếu CO cùng ngày');
r = await j(`/api/co-days?date=${D}`, { method: 'DELETE' });
ck(r.s === 200, 'xoá phiếu CO ngày giả');
const after = await j(`/api/co-summary?date=${D}`);
ck(after.b.stages.every((s) => s.items.length === 0 && s.status === null), 'ngày giả sạch hoàn toàn');

console.log(`\n${F === 0 ? 'PASS' : 'FAIL'} — ${P} ok · ${F} sai`);
process.exit(F ? 1 : 0);
