// BÀI KIỂM CHỖ NỐI 3 APP — Kho sơn Coating (11/11/2026). Chạy ĐÚNG module kho-son-sync.mjs của agent với:
//   · Supabase GIẢ trong bộ nhớ (không ghi Supabase thật — luật dự án)
//   · APP CHÍNH THẬT trên BẢN SAO DB (cổng 8096) + APP COATING GIẢ HTTP (cổng 8097, state thật)
// Do app chính scripts/test/kho_son_noi_3_app_verify.py dựng + gọi. Biến môi trường: MAIN · TOKEN · COATING · LOT_BLUE · LOT_TOL · N0
import { taoKsSync } from './kho-son-sync.mjs';

const { MAIN, TOKEN, COATING, LOT_BLUE, LOT_TOL } = process.env;
const N0 = Number(process.env.N0);
let ok = 0, fail = 0;
const ck = (c, m, got) => { if (c) { ok++; console.log(`   ok  ${m}`); } else { fail++; console.log(`   FAIL ${m}${got !== undefined ? '  (got=' + JSON.stringify(got).slice(0, 300) + ')' : ''}`); } };

// ── Supabase giả: bảng co_paint_slips + Storage ──
const bang = [];
const kho = {};
let soUpload = 0;
function khop(r, qs) {
  for (const [k, v] of qs) {
    if (['select', 'order', 'limit'].includes(k)) continue;
    const [op, ...rest] = v.split('.'); const val = rest.join('.');
    if (op === 'eq' && String(r[k]) !== decodeURIComponent(val)) return false;
    if (op === 'is' && val === 'null' && r[k] != null) return false;
    if (op === 'in' && !val.replace(/[()]/g, '').split(',').includes(r[k])) return false;
  }
  return true;
}
async function sb(path, o = {}) {
  const [, q] = path.split('?');
  const qs = [...new URLSearchParams(q)];
  const rows = bang.filter((r) => khop(r, qs));
  if (!o.method) return JSON.parse(JSON.stringify(rows));
  if (o.method === 'PATCH') { for (const r of rows) Object.assign(r, o.body); return null; }
  throw new Error('sb giả: không hỗ trợ ' + o.method);
}
const upload = async (b, p, text) => { soUpload++; kho[`${b}/${p}`] = text; };
const mainGet = async (p) => { const r = await fetch(MAIN + p, { headers: { 'X-Agent-Token': TOKEN } }); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); };
const mainPost = async (p, body) => {
  const r = await fetch(MAIN + p, { method: 'POST', headers: { 'X-Agent-Token': TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const ks = taoKsSync({ sb, mainGet, mainPost, upload, log: () => {}, logLoi: () => {} });
const coating = async () => (await fetch(COATING + '/test/state')).json();
const coatingPost = (p, b) => fetch(COATING + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const xs = (st) => st.state.txns.filter((t) => t.id.startsWith('XS-'));
// app chính ghi app Coating ở việc nền SAU khi trả lời agent → chờ tới khi điều kiện đúng (tối đa 8 giây)
async function cho(dk) { for (let i = 0; i < 40; i++) { const st = await coating(); if (dk(st)) return st; await new Promise((r) => setTimeout(r, 200)); } return coating(); }
// app tăng ca: Gửi phiếu mới / Sửa / Huỷ (đúng các cột API app tăng ca sẽ ghi)
const gui = (row) => bang.push({ status: 'pending', synced_at: null, last_error: null, main_version: null, history: [],
  cancel_reason: null, created_by_name: 'Nguyễn Văn Thử', sent_at: new Date().toISOString(), ngay: '2026-11-11', ...row });
const sua = (so, thay) => { const r = bang.find((x) => x.so_phieu === so); Object.assign(r, { status: 'pending', synced_at: null, version: r.version + 1 }, thay); };

console.log('\n1. Tồn → file kho-son.json cho điện thoại');
ck(await ks.dayTon() === true, 'lần đầu: đẩy file');
const f1 = JSON.parse(kho['plan-files/kho-son.json']);
const blue = f1.san_pham.find((p) => p.product_id === 'blue');
const loB = (sp) => sp.lo.find((l) => l.lot_id === LOT_BLUE);   // tìm theo mã lô — thứ tự xuất đổi khi HSD đổi
ck(blue && loB(blue) && blue.la_thung && blue.kg_moi_dv === 18.14, 'sơn xanh: có lô 4825022, thùng 18,14 kg', blue && blue.lo);
ck(blue.lo.every((l, i) => i === 0 || (blue.lo[i - 1].han || '9') <= (l.han || '9')), 'lô xếp HSD sớm trước', blue.lo.map((l) => l.han));
const tonBlue0 = loB(blue).ton;
ck(await ks.dayTon() === false && soUpload === 1, 'lần 2 không đổi → KHÔNG đẩy lại (tiết kiệm gói Free)');

console.log('\n2. Tổ trưởng gửi phiếu XS-261111-01 (1 thùng sơn xanh + 10,5 lít toluene)');
gui({ so_phieu: 'XS-261111-01', version: 1, lines: [
  { line_id: 'XS-261111-01-1', product_id: 'blue', lot_id: LOT_BLUE, qty: 1 },
  { line_id: 'XS-261111-01-2', product_id: 'toluene', lot_id: LOT_TOL, qty: 10.5 }] });
ck(await ks.dayPhieu() === 1, 'agent đẩy phiếu sang app chính');
ck(bang[0].synced_at && !bang[0].last_error, 'Supabase: synced_at ghi, không lỗi');
let st = await cho((s) => xs(s).length === 2);
ck(xs(st).length === 2 && st.state.txns.length === N0 + 2, `app Coating có 2 dòng XS (${N0} → ${st.state.txns.length} dòng)`);
const d1 = xs(st).find((t) => t.id === 'XS-261111-01-1');
ck(d1 && d1.type === 'export' && d1.qty === 1 && d1.note.includes('Nguyễn Văn Thử'), 'dòng xuất đúng dạng + tên tổ trưởng trong ghi chú', d1);
await ks.keoTrangThai();
ck(bang[0].status === 'synced' && bang[0].main_version === 1, 'điện thoại: ● đã vào app Coating (status synced, v1)', bang[0]);
await new Promise((r) => setTimeout(r, 300));
// app chính cần 1 lượt đọc để file tồn phản ánh — việc nền đã đọc lại state sau khi ghi
ck(await ks.dayTon() === true, 'tồn đổi → đẩy lại file');
const blue1 = JSON.parse(kho['plan-files/kho-son.json']).san_pham.find((p) => p.product_id === 'blue');
ck(loB(blue1).ton === tonBlue0 - 1 && blue1.line_kg === 18.14, `tồn lô 4825022 ${tonBlue0} → ${tonBlue0 - 1}, Tồn Line 18,14 kg`, loB(blue1));

console.log('\n3. Admin nhập kho trên app Coating đúng lúc tổ trưởng sửa phiếu (409)');
await coatingPost('/test/chen', {});
sua('XS-261111-01', { lines: [{ line_id: 'XS-261111-01-1', product_id: 'blue', lot_id: LOT_BLUE, qty: 2 }],
  history: [{ v: 2, by: 'Nguyễn Văn Thử', at: '2026-11-11T10:05', action: 'sua', reason: 'đếm lại', before: [] }] });
ck(await ks.dayPhieu() === 1, 'agent đẩy bản sửa v2');
st = await cho((s) => xs(s).length === 1 && xs(s)[0].qty === 2);
ck(st.state.txns.some((t) => t.id === 'Tadmin1'), 'dòng admin vừa nhập VẪN CÒN (không bị ghi đè)');
ck(xs(st).length === 1 && xs(st)[0].qty === 2 && xs(st)[0].note.includes('đếm lại'), 'XS: còn 1 dòng 2 thùng, gỡ toluene, ghi lý do sửa', xs(st));
await ks.keoTrangThai();
ck(bang[0].status === 'synced' && bang[0].main_version === 2, 'điện thoại: v2 đã vào app Coating', bang[0]);

console.log('\n4. Huỷ phiếu');
sua('XS-261111-01', { status: 'cancelled', cancel_reason: 'nhập nhầm' });
bang[0].status = 'cancelled';
await ks.dayPhieu();
st = await cho((s) => xs(s).length === 0);
ck(xs(st).length === 0 && st.state.txns.length === N0 + 1, 'app Coating: gỡ hết dòng XS, chỉ còn thêm dòng admin');
await ks.keoTrangThai();
ck(bang[0].status === 'cancelled' && bang[0].main_version === 3, 'điện thoại: phiếu huỷ giữ trạng thái huỷ, v3 đã khớp', bang[0]);

console.log('\n5. Dữ liệu sai → 422 trả về điện thoại');
gui({ so_phieu: 'XS-SAI', version: 1, lines: [{ line_id: 'x', product_id: 'blue', lot_id: LOT_BLUE, qty: 1 }] });
await ks.dayPhieu();
const sai = bang.find((x) => x.so_phieu === 'XS-SAI');
ck(sai.synced_at && /không nhận/.test(sai.last_error || ''), 'phiếu sai: last_error hiện trên điện thoại, không thử lại', sai);

console.log('\n6. Admin xoá dòng XS bên app Coating → không thêm lại + báo điện thoại');
gui({ so_phieu: 'XS-261111-02', version: 1, lines: [{ line_id: 'XS-261111-02-1', product_id: 'blue', lot_id: LOT_BLUE, qty: 1 }] });
await ks.dayPhieu();
st = await cho((s) => s.state.txns.some((t) => t.id === 'XS-261111-02-1'));
await coatingPost('/test/xoa', { id: 'XS-261111-02-1' });
gui({ so_phieu: 'XS-261111-03', version: 1, lines: [{ line_id: 'XS-261111-03-1', product_id: 'toluene', lot_id: LOT_TOL, qty: 5 }] });
await ks.dayPhieu();                                 // phiếu mới kích lượt app chính → phát hiện dòng bị xoá
st = await cho((s) => s.state.txns.some((t) => t.id === 'XS-261111-03-1'));
await new Promise((r) => setTimeout(r, 500));
st = await coating();
ck(!st.state.txns.some((t) => t.id === 'XS-261111-02-1'), 'dòng admin đã xoá KHÔNG bị thêm lại');
await ks.keoTrangThai();
const p2 = bang.find((x) => x.so_phieu === 'XS-261111-02');
ck(/Admin app Coating đã xoá/.test(p2.last_error || ''), 'điện thoại thấy cảnh báo admin đã xoá dòng', p2);

console.log('\n7. Toàn vẹn app Coating');
st = await coating();
const tc = st.state.txns.filter((t) => !t.id.startsWith('XS-') && t.id !== 'Tadmin1');
ck(tc.length === N0, `${N0} dòng gốc của app Coating còn đủ, không bị đổi`);
console.log(`   (app Coating giả: ${st.n_save} lần lưu, ${st.n_409} lần 409)`);
ck(st.n_409 >= 1, 'đã đi qua nhánh 409 thật');

console.log(`\nKẾT QUẢ thu-kho-son: ${ok} ok · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
