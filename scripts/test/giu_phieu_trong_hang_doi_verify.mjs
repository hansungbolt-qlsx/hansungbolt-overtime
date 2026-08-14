/**
 * BÀI KIỂM — PHIẾU PHẢI Ở LẠI HÀNG ĐỢI KHI APP CHÍNH LỖI TẠM THỜI.
 *
 * Vá 14/08/2026 (rà soát toàn luồng xuất/trả kho sau sự cố 13/08):
 * `POST /api/nvl-slips/sync` trước đây đóng dấu `synced_at` ở MỌI lượt ghi ngược,
 * kể cả lượt agent gọi CHỈ để báo lỗi. Mà `synced_at IS NULL` là điều kiện DUY
 * NHẤT giữ phiếu trong hàng đợi. Ghép lại: app chính trả 500 → agent báo lỗi →
 * phiếu bị đóng dấu đã-đồng-bộ → RỜI HÀNG ĐỢI VĨNH VIỄN, điện thoại vẫn hiện
 * 'đã gửi' còn app chính không hề có phiếu ⇒ tồn không bao giờ bị trừ.
 *
 * Nay agent gửi kèm `keep_queued`:
 *   · lỗi 422 (nghiệp vụ, vd "phiếu đã duyệt rồi") → keep_queued=false → đóng dấu
 *   · mọi mã khác (500/502/401…)                   → keep_queued=true  → GIỮ LẠI
 *
 * Bài kiểm chạy THẬT qua route, trên phiếu VỨT ĐI ngày 2099-01-02 (khác ngày với
 * bài chốt phiên bản để hai bài chạy song song không giẫm nhau). Dọn sạch sau.
 *
 * Cách chạy:  node scripts/test/giu_phieu_trong_hang_doi_verify.mjs [http://127.0.0.1:3000]
 */
import { readFileSync } from 'node:fs';
import { SignJWT } from 'jose';

const GOC = process.argv[2] || 'http://127.0.0.1:3000';
const NGAY = '2099-01-02';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const _u = await fetch(`${SB}/rest/v1/users?select=id,username,role&limit=1`, { headers: H });
const [nguoi] = await _u.json();
if (!nguoi?.id) { console.log('🛑 Không lấy được người dùng nào để mượn id'); process.exit(1); }
console.log(`Mượn id người dùng có thật: ${nguoi.username} (${nguoi.role})`);

const token = await new SignJWT({
  userId: nguoi.id,
  username: 'kiemthu', fullName: 'BÀI KIỂM GIỮ HÀNG ĐỢI', role: 'qlsx',
}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1d')
  .sign(new TextEncoder().encode(env.JWT_SECRET));

const KEM = { 'Content-Type': 'application/json', cookie: `session=${token}` };

/** Tạo phiếu ngày 2099 ở dạng NHÁP (`send: false`).
 *
 * ⚠ CỐ Ý KHÔNG gửi (`send: true`). Agent thật ĐANG CHẠY trên máy này (đo 14/08:
 * pid 16276, bật 06:42); vòng poll 60 giây của nó lấy đúng `status='pending'` và
 * `synced_at IS NULL` — tạo phiếu đã-gửi là nó đẩy luôn phiếu rác ngày 2099 sang
 * app chính THẬT. Phiếu nháp chỉ bị vét ở mốc 16:30, còn bài kiểm chạy vài giây
 * rồi dọn sạch, nên không có cửa nào chạm dữ liệu thật.
 */
async function taoPhieuNhap() {
  const r = await fetch(`${GOC}/api/nvl-slips`, {
    method: 'POST',
    headers: KEM,
    body: JSON.stringify({
      kind: 'issue', branch: 'nvl', date: NGAY, send: false, base_n_lines: 0,
      lines: [{
        batch_seq: 1, batch_time: '08:00', department: 'Heading',
        material_code: 'KIEMTHU-HANGDOI', material_name: 'DONG KIEM THU', qty: 1, unit: 'KG',
      }],
    }),
  });
  if (!r.ok) {
    console.log('🛑 Không tạo được phiếu kiểm thử:', r.status, (await r.text()).slice(0, 300));
    process.exit(1);
  }
}

async function phieu() {
  const r = await fetch(
    `${SB}/rest/v1/nvl_day_slips?slip_date=eq.${NGAY}&select=uid,status,synced_at,line_errors`,
    { headers: H });
  return (await r.json())[0] ?? null;
}

/** Gọi đúng như agent gọi khi ghi ngược. */
async function ghiNguoc(body) {
  const r = await fetch(`${GOC}/api/nvl-slips/sync`, {
    method: 'POST', headers: KEM, body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

/** Phiếu có nằm trong hàng đợi agent sẽ nhận không?
 *  Dùng `sweep=1` vì phiếu kiểm thử cố ý để dạng NHÁP (xem `taoPhieuNhap`).
 *  Điều kiện `synced_at IS NULL` — thứ bài kiểm này soi — là CHUNG cho cả hai
 *  vòng (thường và vét), nên kết luận vẫn đúng cho phiếu đã gửi thật. */
async function trongHangDoi(uid) {
  const r = await fetch(`${GOC}/api/nvl-slips/sync?sweep=1`,
                        { headers: { cookie: `session=${token}` } });
  const d = await r.json();
  return (d.slips ?? []).some((s) => s.uid === uid);
}

async function don() {
  const r = await fetch(`${SB}/rest/v1/nvl_day_slips?slip_date=eq.${NGAY}&select=id`, { headers: H });
  for (const s of await r.json()) {
    await fetch(`${SB}/rest/v1/nvl_slip_lines?slip_id=eq.${s.id}`, { method: 'DELETE', headers: H });
    await fetch(`${SB}/rest/v1/nvl_slip_events?slip_id=eq.${s.id}`, { method: 'DELETE', headers: H });
    await fetch(`${SB}/rest/v1/nvl_day_slips?id=eq.${s.id}`, { method: 'DELETE', headers: H });
  }
}

let dat = 0; let hong = 0;
const kiem = (ok, ten, them = '') => {
  console.log(`   ${ok ? '✓' : '✗'} ${ten}${them ? ` — ${them}` : ''}`);
  if (ok) dat += 1; else hong += 1;
};

console.log('Dọn dữ liệu kiểm thử cũ…');
await don();
try {
  console.log('\n1. Tạo phiếu → phải nằm trong hàng đợi chờ agent đẩy');
  await taoPhieuNhap();
  let p = await phieu();
  kiem(p != null, 'phiếu đã tạo', p?.uid);
  kiem(p?.status === 'draft', 'là phiếu nháp (không để agent thật vớ phải)', String(p?.status));
  kiem(p?.synced_at == null, 'chưa đóng dấu đã-đồng-bộ', String(p?.synced_at));
  kiem(await trongHangDoi(p.uid), 'agent NHÌN THẤY phiếu trong hàng đợi');

  console.log('\n2. ⭐ App chính lỗi TẠM THỜI (HTTP 500) → agent báo lỗi kèm keep_queued');
  let r = await ghiNguoc({
    uid: p.uid,
    line_errors: [{ seq: 0, error: 'app chính HTTP 500' }],
    keep_queued: true,
  });
  kiem(r.status === 200, 'ghi ngược thành công', `status=${r.status}`);
  p = await phieu();
  kiem(p?.synced_at == null,
       '🔴 VẪN CHƯA đóng dấu — phiếu Ở LẠI hàng đợi', String(p?.synced_at));
  kiem(Array.isArray(p?.line_errors) && p.line_errors.some((e) => e.seq === 0),
       'lý do lỗi vẫn được ghi cho nhân viên thấy',
       JSON.stringify(p?.line_errors).slice(0, 60));
  kiem(await trongHangDoi(p.uid), '🔴 agent VẪN nhận lại phiếu ở vòng sau');

  console.log('\n3. App chính từ chối NGHIỆP VỤ (HTTP 422) → keep_queued=false, ngừng đẩy');
  r = await ghiNguoc({
    uid: p.uid,
    line_errors: [{ seq: 0, error: 'Phiếu đã được duyệt trên app chính' }],
    keep_queued: false,
  });
  kiem(r.status === 200, 'ghi ngược thành công', `status=${r.status}`);
  p = await phieu();
  kiem(p?.synced_at != null, 'ĐÃ đóng dấu đã-đồng-bộ', String(p?.synced_at));
  kiem(!(await trongHangDoi(p.uid)), 'agent KHÔNG đẩy lại nữa');

  console.log('\n4. Không gửi keep_queued (bản agent CŨ) → giữ nguyên nết cũ, không gãy');
  await fetch(`${SB}/rest/v1/nvl_day_slips?slip_date=eq.${NGAY}`, {
    method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ synced_at: null }),
  });
  p = await phieu();
  kiem(p?.synced_at == null, 'đã đặt lại về chưa-đồng-bộ để thử');
  r = await ghiNguoc({ uid: p.uid, status: 'pending' });
  kiem(r.status === 200, 'ghi ngược thành công', `status=${r.status}`);
  p = await phieu();
  kiem(p?.synced_at != null,
       'vẫn đóng dấu như trước ⇒ deploy route trước, agent sau cũng KHÔNG gãy',
       String(p?.synced_at));
} finally {
  console.log('\nDọn dữ liệu kiểm thử…');
  await don();
  kiem((await phieu()) == null, 'đã dọn sạch phiếu ngày 2099-01-02');
}

console.log(`\n${'='.repeat(60)}`);
console.log(hong === 0 ? `✅ ĐẠT ${dat}/${dat} phép kiểm` : `🛑 HỎNG ${hong}, đạt ${dat}`);
console.log('='.repeat(60));
process.exit(hong === 0 ? 0 : 1);
