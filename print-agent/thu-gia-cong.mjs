// BÀI KIỂM CHỖ NỐI 2 APP — nhập liệu gia công (14/10/2026). Chạy ĐÚNG module gia-cong-sync.mjs của agent với:
//   · Supabase GIẢ trong bộ nhớ (không ghi Supabase thật — luật dự án)
//   · APP CHÍNH THẬT chạy trên BẢN SAO DB (cổng 8095) — do scripts/test/gc_noi_2_app_verify.py (app chính) dựng + gọi file này
// Biến môi trường: MAIN (http://127.0.0.1:8095) · TOKEN (X-Agent-Token) · U / P (tài khoản duyệt thử trên bản sao)
import { taoGcSync } from './gia-cong-sync.mjs';

const MAIN = process.env.MAIN, TOKEN = process.env.TOKEN;
let ok = 0, fail = 0;
const ck = (c, m, got) => { if (c) { ok++; console.log(`   ok  ${m}`); } else { fail++; console.log(`   FAIL ${m}${got !== undefined ? '  (got=' + JSON.stringify(got).slice(0, 300) + ')' : ''}`); } };

// ── Supabase giả: bảng gc_slips + Storage ──
const bang = [];
const kho = {};
let soGoiSb = 0;
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
  soGoiSb++;
  const [, q] = path.split('?');
  const qs = [...new URLSearchParams(q)];
  const rows = bang.filter((r) => khop(r, qs));
  if (!o.method) return JSON.parse(JSON.stringify(rows));
  if (o.method === 'PATCH') { for (const r of rows) Object.assign(r, o.body, { updated_at: new Date().toISOString() }); return null; }
  throw new Error('sb giả: không hỗ trợ ' + o.method);
}
const upload = async (b, p, text) => { soGoiSb++; kho[`${b}/${p}`] = text; };
const mainGet = async (p) => { const r = await fetch(MAIN + p, { headers: { 'X-Agent-Token': TOKEN } }); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); };
const mainPost = async (p, body) => {
  const r = await fetch(MAIN + p, { method: 'POST', headers: { 'X-Agent-Token': TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const gc = taoGcSync({ sb, mainGet, mainPost, upload, log: () => {}, logLoi: () => {} });
const guiTuDienThoai = (row) => bang.push({ status: 'pending', synced_at: null, sent_at: new Date().toISOString(), note: null,
  created_by_name: 'Thử qlsx', reject_reason: null, ...row });

// đăng nhập app chính (bản sao) để duyệt / trả lại như anh Hữu bấm
let cookie = '';
{
  const r = await fetch(MAIN + '/login', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: process.env.U, password: process.env.P }) });
  cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  ck(r.status === 303 && cookie, 'đăng nhập app chính bản sao');
}
const bam = async (url, form = {}) => fetch(MAIN + url, { method: 'POST', redirect: 'manual', headers: { Cookie: cookie,
  'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
const idCua = async (uid) => {
  const r = await fetch(MAIN + '/giacong/dat-hang?loc=tat_ca', { headers: { Cookie: cookie } });
  const r2 = await fetch(MAIN + '/giacong/nhap-kho-gc?loc=tat_ca', { headers: { Cookie: cookie } });
  return { dat: await r.text(), nhap: await r2.text() };
};

console.log('\n1. Đẩy gương (danh sách cho điện thoại)');
ck(await gc.dayGuong() === true, 'lần đầu: đẩy file gc-guong.json');
const g = JSON.parse(kho['plan-files/gc-guong.json'] || '{}');
ck(g.cho_dat?.length > 100 && g.cho_ve?.length > 50, `có ${g.cho_dat?.length} chỉ thị chờ đặt · ${g.cho_ve?.length} thùng chờ về`);
const nccs = (g.ncc || []).map((n) => `${n.cong_doan}:${n.ma}`).sort();
ck(JSON.stringify(nccs) === JSON.stringify(['15:VVN', '20:HTP', '67:NPT', '70:VIK', '80:NPT', '80:TC', '89:VVN']), 'NCC: 70 VIK · 80 NPT, TC + CĐ mới 15 VVN · 20 HTP · 67 NPT · 89 VVN (14/10 đêm)', nccs);
const n0 = soGoiSb;
ck(await gc.dayGuong() === false && soGoiSb === n0, 'lần 2 không đổi → KHÔNG đẩy (0 lượt Supabase)');

console.log('\n2. Phiếu đặt + phiếu nhập từ điện thoại → app chính');
const cd = g.cho_dat.find((x) => x.cong_doan === '80' && x.vao > 0);
const tv = g.cho_ve.find((x) => x.ncc === 'NPT' && x.cong_doan === '80' && x.kg_dat - x.kg_da_ve > 2);
guiTuDienThoai({ uid: 'GC-D-THU-1', loai: 'dat', cong_doan: '80', ncc: 'NPT',
  lines: [{ saeji_no: cd.saeji_no, ma_hang: cd.ma_hang, ten_hang: cd.ten_hang, kg: 120 }] });
guiTuDienThoai({ uid: 'GC-N-THU-1', loai: 'nhap', cong_doan: '80', ncc: 'NPT',
  lines: [{ saeji_no: tv.saeji_no, ma_hang: tv.ma_hang, kg: tv.kg_dat - tv.kg_da_ve, dat_no: tv.dat_no, dat_seq: tv.dat_seq,
    kg_dat: tv.kg_dat, kg_da_ve: tv.kg_da_ve, hoan_thanh: 1 }] });
guiTuDienThoai({ uid: 'GC-D-THU-LOI', loai: 'dat', cong_doan: '80', ncc: 'NPT', lines: [{ saeji_no: cd.saeji_no, kg: 10.5 }] });
ck(await gc.dayPhieu() === 2, '2 phiếu hợp lệ sang app chính');
const r1 = bang.find((r) => r.uid === 'GC-D-THU-1'), r2 = bang.find((r) => r.uid === 'GC-N-THU-1'), r3 = bang.find((r) => r.uid === 'GC-D-THU-LOI');
ck(r1.synced_at && r1.status === 'pending' && r2.synced_at, 'đánh dấu đã đẩy (synced_at), vẫn chờ duyệt');
ck(r3.status === 'rejected' && /kg phải là số NGUYÊN/.test(r3.reject_reason || ''), 'phiếu kg lẻ: app chính 422 → trả về điện thoại có lý do', r3.reject_reason);
const ds = await idCua();
ck(ds.dat.includes('qlsx') || ds.dat.includes('Thử qlsx'), 'app chính: phiếu đặt hiện trong danh sách');
ck(await gc.dayPhieu() === 0, 'chạy lại: không đẩy trùng');

console.log('\n3. Duyệt / trả lại trên app chính → trạng thái về điện thoại');
const tt = (await mainGet('/api/ot/gc-phieu-trang-thai?ngay=14')).phieu;
const pDat = tt.find((x) => x.uid === 'GC-D-THU-1'), pNhap = tt.find((x) => x.uid === 'GC-N-THU-1');
ck(pDat && pNhap && pDat.trang_thai === 'pending', 'app chính có 2 phiếu chờ duyệt', tt);
const html = (await (await fetch(MAIN + '/giacong/dat-hang?loc=tat_ca', { headers: { Cookie: cookie } })).text());
const idDat = (html.match(/\/giacong\/dat-hang\/(\d+)/) || [])[1];
const htmlN = (await (await fetch(MAIN + '/giacong/nhap-kho-gc?loc=tat_ca', { headers: { Cookie: cookie } })).text());
const idNhap = (htmlN.match(/\/giacong\/nhap-kho-gc\/(\d+)/) || [])[1];
await bam(`/giacong/dat-hang/${idDat}/duyet`);
await bam(`/giacong/nhap-kho-gc/${idNhap}/tra-lai`, { ly_do: 'Sai thùng, kiểm lại' });
ck(await gc.keoTrangThai() >= 2, '2 trạng thái đổi → ghi về (bản sao DB có thể có phiếu thật, vd #1 14/10)');
ck(r1.status === 'approved' && r1.approved_by, 'phiếu đặt: đã duyệt + người duyệt', r1);
ck(r2.status === 'rejected' && r2.reject_reason === 'Sai thùng, kiểm lại', 'phiếu nhập: bị trả lại + lý do', r2);
const n1 = soGoiSb;
ck(await gc.keoTrangThai() === 0 && soGoiSb === n1, 'chạy lại: không đổi → 0 lượt Supabase');

console.log('\n4. Sửa phiếu bị trả lại rồi gửi lại');
Object.assign(r2, { status: 'pending', synced_at: null, reject_reason: null, sent_at: new Date().toISOString() });
r2.lines[0].kg = Math.max(1, r2.lines[0].kg - 1); r2.lines[0].hoan_thanh = 0;
ck(await gc.dayPhieu() === 1 && r2.synced_at, 'gửi lại → app chính nhận bản mới');
const tt2 = (await mainGet('/api/ot/gc-phieu-trang-thai?ngay=14')).phieu.find((x) => x.uid === 'GC-N-THU-1');
ck(tt2.trang_thai === 'pending' && tt2.version >= 3, 'app chính: về chờ duyệt, version tăng', tt2);
ck(await gc.keoTrangThai() === 0 && r2.status === 'pending', 'đang chờ duyệt: không ghi đè trạng thái điện thoại');

console.log('\n5. Không đè khi người dùng đang sửa');
Object.assign(r1, { status: 'draft' });
await bam(`/giacong/dat-hang/${idDat}/tra-lai`, { ly_do: 'thử' });
await gc.keoTrangThai();
ck(r1.status === 'draft', 'phiếu điện thoại đang nháp → trạng thái app chính không đè');

console.log(`\nKẾT QUẢ: ${ok} ok · ${fail} FAIL · ${soGoiSb} lượt Supabase giả`);
process.exit(fail ? 1 : 0);
