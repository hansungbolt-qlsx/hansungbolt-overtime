// Print agent for Hansungbolt Overtime
// Chạy trên máy tính admin (có kết nối máy in laser + Internet).
// Poll app mỗi POLL_INTERVAL_MS để lấy job in mới, render PDF, gửi máy in.

import 'dotenv/config';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer';
import printer from 'pdf-to-printer';
import { taoHub } from './realtime-hub.mjs';
import { taoGcSync } from './gia-cong-sync.mjs';

const execFileP = promisify(execFile);
const AGENT_DIR = dirname(fileURLToPath(import.meta.url));

const {
  APP_URL,
  AGENT_SECRET,
  LOGIN_USERNAME,
  LOGIN_PASSWORD,
  PRINTER_NAME,
  POLL_INTERVAL_MS = '10000',
  // In DCCD qua app chính (localhost) — user 13/7
  MAIN_APP_URL,
  MAIN_APP_TOKEN,
  // Nối THẲNG Supabase cho hàng đợi in — thêm 07/08/2026.
  // Thiếu 2 biến này thì agent tự quay về đường Vercel như cũ (xem SB_ON).
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} = process.env;

// Validate config
const required = { APP_URL, AGENT_SECRET, LOGIN_USERNAME, LOGIN_PASSWORD, PRINTER_NAME };
for (const [k, v] of Object.entries(required)) {
  if (!v) {
    console.error(`Thiếu biến môi trường ${k}. Copy .env.example thành .env rồi điền đầy đủ.`);
    process.exit(1);
  }
}

// Giá trị thô từ .env — được áp hai chốt sàn ở dưới (xem POLL_MS), sau khi đã
// biết SB_ON, vì sàn khác nhau tuỳ agent hỏi Supabase hay hỏi Vercel.
const _pollThoLenh = Number(POLL_INTERVAL_MS);

// ─────────────────────────────────────────────────────────────────────────────
// NỐI THẲNG SUPABASE CHO HÀNG ĐỢI IN — 07/08/2026
//
// Vì sao: đo trên nhật ký Vercel ngày 07/08 — agent hỏi `/api/print-jobs` mỗi
// 4,31 giây (3 s ngủ + 1,31 s mỗi lượt), tức **835 lượt/giờ = 88% toàn bộ lượt
// gọi hàm của cả tháng**, để nhận ~5 lệnh in mỗi ngày. Tỷ lệ 1 lệnh in trên
// 1.380 lượt hỏi. Gói Hobby chỉ có 4 giờ CPU cho mỗi 30 ngày và **KHÔNG có ngày
// reset** (cửa sổ trượt) ⇒ đã lên 75% và không tự hết.
//
// Cách sửa: đọc `print_jobs` THẲNG từ Supabase. Vercel trở lại đúng vai trò
// "tên miền cho người dùng truy cập" như anh Hữu chốt 07/08/2026.
//
// Vì sao phải dùng service_role: `docs/sql/11-print-jobs.sql` có
// ENABLE ROW LEVEL SECURITY và toàn bộ 22 file SQL KHÔNG có `CREATE POLICY` nào
// → đã thử thật: khoá anon đọc `print_jobs` trả về `[]`. Chỉ service_role vượt
// được RLS. Khoá này vốn đã nằm trên máy này trong `.env.local`.
//
// An toàn: thiếu 1 trong 2 biến thì SB_ON = false và mọi thứ chạy y như cũ.
// ─────────────────────────────────────────────────────────────────────────────
const SB_ON = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// ⚠️ HAI CHỐT AN TOÀN CỦA NHỊP POLL — 07/08/2026
//
// 1. SÀN THEO ĐÍCH. Hỏi Supabase thì nhanh bao nhiêu cũng được (không có hạn mức
//    đếm truy vấn, chỉ tốn egress ~3% ở nhịp 3 giây). Nhưng nếu mất 2 biến
//    SUPABASE_* thì agent quay về hỏi VERCEL — mà ở đó 3 giây = 835 lượt/giờ =
//    đúng cái đã đẩy hạn mức lên 75%. Nên đường lui BỊ ÉP chậm tối thiểu 15 giây.
//    Hỏng cấu hình khi đó chỉ làm in chậm, KHÔNG làm chết dịch vụ.
//
// 2. SÀN TUYỆT ĐỐI 1 GIÂY. Trước đây là `Number(POLL_INTERVAL_MS)` trần trụi:
//    gõ sai .env (vd "15 000" hay "3s") → NaN → setTimeout(NaN) chạy ngay lập tức
//    → vòng lặp không nghỉ, đốt hết hạn mức trong một buổi mà không ai biết.
//
// 3. LOG SUPABASE (12/10/2026, anh Hữu chốt nhịp 10 giây, chấp nhận in chậm thêm tối đa 7 giây):
//    mỗi lượt gọi Supabase sinh 1 dòng log; gói Free cho 1 GB log/tháng (Supabase áp từ đầu 2027).
//    Đo Logs Explorer 12/10: 38.383 lượt API/24 giờ, agent chiếm 98 %, riêng hỏi/dọn lệnh in 83 %
//    (nhịp 3 giây) → log 1,07 GB/tháng (107 %). Nhịp 10 giây + dọn 5 phút ⇒ ước ~0,55 GB/tháng.
const POLL_MS = SB_ON
  ? Math.max(1_000, _pollThoLenh || 10_000)
  : Math.max(15_000, _pollThoLenh || 15_000);
if (POLL_MS !== _pollThoLenh) {
  console.log(`⚠ POLL_INTERVAL_MS="${POLL_INTERVAL_MS}" bị điều chỉnh → dùng ${POLL_MS}ms`
    + (SB_ON ? '' : ' (đường lui qua Vercel — ép sàn 15 giây để giữ hạn mức)'));
}

// TTL 2 phút — PHẢI giữ đúng bằng `lib/print-jobs-expire.ts` bên app.
// Đổi một bên mà quên bên kia là lệnh in hết hạn vẫn chạy ra giấy.
const PRINT_JOB_TTL_MS = 2 * 60_000;

// ── REALTIME (GĐ3, 12/10/2026 — docs/realtime-agent-thiet-ke.md) ─────────────────────────────────────────
// CÔNG TẮC: REALTIME_ON=1 trong .env. Tắt (mặc định) = agent chạy y như trước: hỏi lệnh in mỗi POLL_MS.
// Bật: Supabase đẩy tin lệnh in mới → agent hỏi NGAY (không chờ nhịp). Lưới dự phòng (anh Hữu chốt phương án B):
//   Realtime KHOẺ  → giờ làm (07:00–18:59 T2–T7 giờ VN) hỏi 60 giây · ngoài giờ chỉ dựa Realtime + canary
//   KHÔNG KHOẺ     → hỏi mỗi POLL_MS (10 giây) như trước Realtime — xấu nhất không tệ hơn trước
// Nhận lệnh vẫn qua nhanLenh() (nguyên tử, chống in trùng). Lõi kết nối + tự chữa: realtime-hub.mjs.
const REALTIME_ON = process.env.REALTIME_ON === '1' && SB_ON;
const DU_PHONG_IN_MS = 60_000;
const CANH_BAO_SAU_MS = 10 * 60_000;       // L8: không khoẻ quá 10 phút → nhắn Telegram (1 lần), khoẻ lại → nhắn
const BOT_CFG = 'F:/0. Quản lý nguyên liệu/telegram-bot/bot.cfg';
let hub = null;
let coTinIn = false;
let danhThuc = null;
let lanHoiInCuoi = 0;
const rtDem = { khongKhoeTu: 0, daBao: false, phutKhongKhoe: 0, lanCuoiGhi: 0 };

// 3 tháng 11/07→12/10: 393/393 lệnh in tạo trong 07:00–18:59, không có Chủ nhật.
function gioLamVN(d = new Date()) {
  const vn = new Date(d.getTime() + 7 * 3600_000);
  const thu = vn.getUTCDay();
  const gio = vn.getUTCHours();
  return thu >= 1 && thu <= 6 && gio >= 7 && gio < 19;
}
function danhThucVong() { if (danhThuc) { const f = danhThuc; danhThuc = null; f(); } }
function choHoacDanhThuc(ms) {
  return new Promise((r) => {
    const t = setTimeout(() => { danhThuc = null; r(); }, ms);
    danhThuc = () => { clearTimeout(t); r(); };
  });
}
function nhipHoiIn() {
  if (!hub || !hub.trangThai().khoe) return POLL_MS;
  return gioLamVN() ? DU_PHONG_IN_MS : Infinity;
}
async function nhanTelegram(text) {
  try {
    const cfg = JSON.parse(readFileSync(BOT_CFG, 'utf8'));
    await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(cfg.allowed_chat_id), text }),
    });
  } catch (e) { console.error(`[${new Date().toISOString()}] Telegram lỗi: ${e.message}`); }
}
// L8 — gọi mỗi vòng lặp: theo dõi thời gian không khoẻ, cảnh báo, ghi realtime-trangthai.json mỗi phút
function canhRealtime() {
  if (!hub) return;
  const s = hub.trangThai();
  const now = Date.now();
  if (!s.khoe) {
    if (!rtDem.khongKhoeTu) rtDem.khongKhoeTu = now;
    if (!rtDem.daBao && now - rtDem.khongKhoeTu >= CANH_BAO_SAU_MS) {
      rtDem.daBao = true;
      nhanTelegram(`⚠ Agent in: Realtime KHÔNG KHOẺ ${Math.round((now - rtDem.khongKhoeTu) / 60_000)} phút (${s.lyDo}). `
        + `Agent đang tự hỏi mỗi ${POLL_MS / 1000} giây — in vẫn chạy.`);
    }
  } else if (rtDem.khongKhoeTu) {
    const phut = Math.round((now - rtDem.khongKhoeTu) / 60_000);
    rtDem.phutKhongKhoe += phut;
    if (rtDem.daBao) nhanTelegram(`✅ Agent in: Realtime khoẻ lại sau ${phut} phút.`);
    rtDem.khongKhoeTu = 0;
    rtDem.daBao = false;
  }
  if (now - rtDem.lanCuoiGhi >= 60_000) {
    rtDem.lanCuoiGhi = now;
    const n = nhipHoiIn();
    try {
      writeFileSync(join(AGENT_DIR, 'realtime-trangthai.json'), JSON.stringify({
        cap_nhat: new Date().toISOString(), ...s, phut_khong_khoe_tich_luy: rtDem.phutKhongKhoe,
        khong_khoe_tu: rtDem.khongKhoeTu ? new Date(rtDem.khongKhoeTu).toISOString() : null,
        nhip_hoi_in_ms: n === Infinity ? null : n,
      }, null, 1));
    } catch { /* đo hỏng KHÔNG được làm chết vòng in */ }
  }
}

// Đếm lượt gọi ra ngoài, ghi ra file cho bản tin sức khỏe buổi sáng đọc.
//
// ⚠️ PHẢI NẠP LẠI FILE KHI KHỞI ĐỘNG. Bản đầu của bộ đếm này giữ số trong bộ nhớ,
// nên watchdog dựng lại agent (mỗi 5 phút nếu nó chết) là số của NGÀY về 0 →
// bản tin sức khỏe báo 0,0% trong khi thực tế có thể đang cao. Đếm sai theo hướng
// "yên tâm giả" thì tệ hơn không đếm.
const DEM_FILE = join(AGENT_DIR, 'dem-luot-goi.json');
const dem = {
  ngay: '', gio: -1, tu_luc: new Date().toISOString(),
  vercel_gio: 0, supabase_gio: 0, vercel_ngay: 0, supabase_ngay: 0,
};

(function napLaiBoDem() {
  try {
    const cu = JSON.parse(readFileSync(DEM_FILE, 'utf8'));
    if (cu.ngay === new Date().toISOString().slice(0, 10)) {
      dem.ngay = cu.ngay;
      dem.vercel_ngay = Number(cu.vercel_ngay) || 0;
      dem.supabase_ngay = Number(cu.supabase_ngay) || 0;
      dem.tu_luc = cu.tu_luc || dem.tu_luc;
      console.log(`Bộ đếm lượt gọi: nạp lại của hôm nay — Vercel ${dem.vercel_ngay}, `
        + `Supabase ${dem.supabase_ngay} (tính từ ${dem.tu_luc})`);
    }
  } catch { /* chưa có file hoặc file hỏng → đếm từ 0, không sao */ }
})();

function ghiNhanGoi(dich) {
  const t = new Date();
  const ngay = t.toISOString().slice(0, 10);
  const gio = t.getUTCHours();
  if (dem.ngay !== ngay) {
    dem.ngay = ngay; dem.vercel_ngay = 0; dem.supabase_ngay = 0;
    dem.tu_luc = t.toISOString();
  }
  if (dem.gio !== gio) { dem.gio = gio; dem.vercel_gio = 0; dem.supabase_gio = 0; }
  if (dich === 'vercel') { dem.vercel_gio++; dem.vercel_ngay++; }
  else { dem.supabase_gio++; dem.supabase_ngay++; }
  try {
    writeFileSync(DEM_FILE, JSON.stringify({ ...dem, cap_nhat: t.toISOString() }, null, 2));
  } catch { /* đếm hỏng KHÔNG được làm chết vòng in */ }
}

/** Gọi PostgREST của Supabase. Ném lỗi nếu không 2xx. */
async function sb(path, opts = {}) {
  ghiNhanGoi('supabase');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status} ${t}`.slice(0, 200));
  }
  return res;
}

const TMP_DIR = join(tmpdir(), 'hansungbolt-print');
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// -----------------------------------------------------------
// Session management
// -----------------------------------------------------------
let sessionCookie = null;

async function login() {
  console.log(`[${new Date().toISOString()}] Login as ${LOGIN_USERNAME}...`);
  ghiNhanGoi('vercel');
  const res = await fetch(`${APP_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: LOGIN_USERNAME,
      password: LOGIN_PASSWORD,
      remember: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Login failed HTTP ${res.status}: ${err.error ?? res.statusText}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('Login response không có set-cookie header');

  // Extract session cookie value: session=xxx; Path=/; HttpOnly; ...
  const match = setCookie.match(/session=([^;]+)/);
  if (!match) throw new Error('Không tìm thấy session cookie trong response');
  sessionCookie = match[1];
  console.log(`[${new Date().toISOString()}] Login OK`);
}

// -----------------------------------------------------------
// Print jobs API
// -----------------------------------------------------------
/** Dọn lệnh in quá hạn — bản sao Y HỆT `lib/print-jobs-expire.ts` bên app.
 *
 * Vì sao agent phải tự làm: trước 07/08/2026 route `GET /api/print-jobs` của
 * Vercel dọn giúp TRƯỚC khi trả danh sách, nên agent không bao giờ nhận được
 * lệnh đã hết hạn. Đọc thẳng Supabase thì không còn ai dọn hộ ⇒ nếu bỏ bước này,
 * agent tắt 10 phút rồi bật lại sẽ IN RA lệnh cũ — đúng cái bug đã trả giá 11/7.
 */
// Dọn mỗi 5 phút (12/10/2026, trước là 30 giây — giảm log Supabase). An toàn vì pollPendingJobs
// CHỈ lấy lệnh tạo trong 2 phút gần nhất (created_at > now − TTL): lệnh quá hạn chưa kịp dọn
// cũng KHÔNG BAO GIỜ được in ra; dọn chỉ còn việc đổi trạng thái sang 'error' để app báo người gửi.
const DON_MOI_MS = 5 * 60_000;
let lanDonCuoi = 0;

async function donJobHetHan() {
  if (Date.now() - lanDonCuoi < DON_MOI_MS) return;
  lanDonCuoi = Date.now();
  const cutoff = new Date(Date.now() - PRINT_JOB_TTL_MS).toISOString();
  const patch = JSON.stringify({
    status: 'error',
    finished_at: new Date().toISOString(),
    error_message: 'Quá 2 phút chưa in được — lệnh đã tự hủy, hãy gửi lại',
  });
  const h = { Prefer: 'return=minimal' };
  // `cutoff` do toISOString() sinh ra nên kết thúc bằng 'Z' — đã thử: dạng
  // '+00:00' làm PostgREST trả HTTP 400 (dấu + bị hiểu là khoảng trắng trong URL).
  await sb(`print_jobs?status=eq.pending&created_at=lt.${cutoff}`,
    { method: 'PATCH', body: patch, headers: h });
  await sb(`print_jobs?status=eq.printing&started_at=lt.${cutoff}`,
    { method: 'PATCH', body: patch, headers: h });
}

async function pollPendingJobs() {
  if (!SB_ON) {
    // Đường cũ qua Vercel — chỉ chạy khi thiếu biến Supabase.
    ghiNhanGoi('vercel');
    const res = await fetch(`${APP_URL}/api/print-jobs?status=pending`, {
      headers: { Authorization: `Bearer ${AGENT_SECRET}` },
    });
    if (!res.ok) {
      throw new Error(`Poll HTTP ${res.status}`);
    }
    const { jobs } = await res.json();
    return jobs ?? [];
  }
  await donJobHetHan();
  // Chỉ lệnh còn hạn — cutoff dạng ...Z (dạng +00:00 làm PostgREST trả 400, xem donJobHetHan)
  const cutoff = new Date(Date.now() - PRINT_JOB_TTL_MS).toISOString();
  const res = await sb(
    `print_jobs?status=eq.pending&created_at=gt.${cutoff}`
    + '&select=id,type,ref_id,requested_by,status,created_at'
    + '&order=created_at.asc&limit=5',
  );
  return (await res.json()) ?? [];
}

async function updateJob(id, status, errorMessage) {
  // Ba dòng dưới PHẢI khớp `app/api/print-jobs/[id]/route.ts` — lệch là nút In
  // trên điện thoại báo sai trạng thái, và TTL mất mốc `started_at` để tính.
  const patch = { status };
  if (status === 'printing') patch.started_at = new Date().toISOString();
  if (status === 'done' || status === 'error') patch.finished_at = new Date().toISOString();
  if (status === 'error' && errorMessage) patch.error_message = errorMessage;

  if (!SB_ON) {
    ghiNhanGoi('vercel');
    const res = await fetch(`${APP_URL}/api/print-jobs/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AGENT_SECRET}`,
      },
      body: JSON.stringify({ status, error_message: errorMessage }),
    });
    if (!res.ok) {
      console.error(`Update job ${id} failed: ${res.status}`);
    }
    return;
  }
  try {
    await sb(`print_jobs?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
      headers: { Prefer: 'return=minimal' },
    });
  } catch (e) {
    console.error(`Update job ${id} failed: ${e.message}`);
  }
}

/**
 * NHẬN LỆNH NGUYÊN TỬ (12/10/2026 — GĐ0 thiết kế Realtime, docs/realtime-agent-thiet-ke.md lớp L6).
 * Đổi pending → printing CHỈ KHI lệnh còn 'pending' (điều kiện nằm trong câu PATCH) và đọc lại số dòng đổi:
 * 1 dòng = mình nhận được → in · 0 dòng = đã có lượt khác nhận / đã hết hạn → BỎ QUA, không in.
 * Trước đây đổi trạng thái không điều kiện ⇒ khi 2 đường cùng thấy 1 lệnh (tin Realtime + vòng hỏi) sẽ in 2 bản.
 * Lỗi mạng/Supabase → KHÔNG in lượt này (vòng hỏi 10 giây sau thử lại, còn trong TTL 2 phút): ưu tiên không in trùng.
 * Đường lui qua Vercel (!SB_ON) giữ nguyên cách cũ.
 */
async function nhanLenh(id) {
  if (!SB_ON) {
    await updateJob(id, 'printing');
    return true;
  }
  try {
    const res = await sb(`print_jobs?id=eq.${id}&status=eq.pending`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'printing', started_at: new Date().toISOString() }),
      headers: { Prefer: 'return=representation' },
    });
    const rows = (await res.json()) || [];
    return rows.length === 1;
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Nhận lệnh ${id.slice(0, 8)} lỗi — để lượt sau: ${e.message}`);
    return false;
  }
}

// -----------------------------------------------------------
// Puppeteer render PDF
// -----------------------------------------------------------
let browser = null;

async function ensureBrowser() {
  if (browser && browser.connected) return browser;
  console.log(`[${new Date().toISOString()}] Launch Chromium...`);
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return browser;
}

function jobUrl(job) {
  if (job.type === 'registration') {
    return `${APP_URL}/dashboard/registrations/${job.ref_id}/view`;
  }
  if (job.type === 'labels_day') {
    return `${APP_URL}/print/labels?date=${job.ref_id}`;
  }
  if (job.type === 'overtime_summary') {
    // ref_id: 'YYYY-MM' hoặc 'YYYY-MM|DEPT'
    const [month, dept] = job.ref_id.split('|');
    let url = `${APP_URL}/print/overtime-summary?month=${month}`;
    if (dept) url += `&dept=${dept}`;
    return url;
  }
  if (job.type === 'co_day') {
    // Bảng Kết quả Coating ngày (anh Hữu 05/10/2026) — A4 ngang; 'YYYY-MM-DD|84' = A/B (06/10/2026)
    const [date, st] = String(job.ref_id).split('|');
    return `${APP_URL}/print/co-day?date=${date}${st === '84' ? '&stage=84' : ''}`;
  }
  throw new Error(`Unknown job type: ${job.type}`);
}

async function renderPDF(job) {
  const br = await ensureBrowser();
  const page = await br.newPage();
  try {
    // Set cookie session để access authenticated page
    const url = jobUrl(job);
    const host = new URL(APP_URL).hostname;
    await page.setCookie({
      name: 'session',
      value: sessionCookie,
      domain: host,
      path: '/',
      httpOnly: true,
      secure: true,
    });

    // Ngăn window.print() dialog popup (trang tem NVL có auto print)
    await page.evaluateOnNewDocument(() => {
      // eslint-disable-next-line no-undef
      window.print = () => {};
    });

    console.log(`[${new Date().toISOString()}] Navigate: ${url}`);
    // Tem NVL nhiều ảnh Supabase → chờ mạng lặng (networkidle2).
    // Phiếu/tổng hợp chỉ chữ + bảng → domcontentloaded là đủ (nhanh hơn ~10-20s);
    // ảnh logo + font chờ riêng bên dưới.
    const waitMode = job.type === 'labels_day' ? 'networkidle2' : 'domcontentloaded';
    let response = await page.goto(url, {
      waitUntil: waitMode,
      timeout: 60000,
    });
    // Session hết hạn → bị redirect về /login → login lại + thử 1 lần nữa
    if (page.url().includes('/login')) {
      console.log(`[${new Date().toISOString()}] Session hết hạn, login lại...`);
      await login();
      await page.setCookie({
        name: 'session',
        value: sessionCookie,
        domain: host,
        path: '/',
        httpOnly: true,
        secure: true,
      });
      response = await page.goto(url, { waitUntil: waitMode, timeout: 60000 });
      if (page.url().includes('/login')) {
        throw new Error('Vẫn bị đá về /login sau khi login lại');
      }
    }
    if (!response || !response.ok()) {
      throw new Error(`Load page failed: HTTP ${response?.status()} ${response?.statusText()}`);
    }

    // Chờ đúng thứ cần: mọi <img> tải xong (logo, tem) + font sẵn sàng,
    // thay cho sleep 1.5s cố định — thường xong trong <500ms nhờ cache.
    await page
      .evaluate(() =>
        Promise.all([
          document.fonts.ready,
          ...Array.from(document.images)
            .filter((img) => !img.complete)
            .map(
              (img) =>
                new Promise((res) => {
                  img.onload = img.onerror = res;
                }),
            ),
        ]),
      )
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 200));

    // Tổng hợp giờ tăng ca dùng A4 landscape (bảng nhiều cột)
    const isLandscape = job.type === 'overtime_summary' || job.type === 'co_day';
    // preferCSSPageSize: tôn trọng @page của từng trang
    // (tem: A4 dọc lề 0 · tổng hợp: A4 ngang lề 1cm · phiếu: A4 dọc lề 8mm)
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: isLandscape,
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close().catch(() => {});
  }
}

// -----------------------------------------------------------
// KHSX: tải file ISO từ app → Excel COM xuất PDF (giữ page setup) → in
// -----------------------------------------------------------
const KHSX_SHEET = { khsx_tong: 'KHSX tổng', khsx_homnay: 'KHSX hôm nay' };

async function printKhsx(job) {
  ghiNhanGoi('vercel');
  const res = await fetch(`${APP_URL}/api/plan-files/${job.ref_id}/download`, {
    headers: { Cookie: `session=${sessionCookie}` },
  });
  if (!res.ok) throw new Error(`Tải file KHSX lỗi HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const xlsxPath = join(TMP_DIR, `khsx-${job.id}.xlsx`);
  const pdfPath = join(TMP_DIR, `khsx-${job.id}.pdf`);
  writeFileSync(xlsxPath, buf);
  try {
    await execFileP(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass',
       '-File', join(AGENT_DIR, 'xlsx2pdf.ps1'),
       '-InFile', xlsxPath, '-OutFile', pdfPath, '-SheetName', KHSX_SHEET[job.type]],
      { timeout: 120000 },
    );
    if (!existsSync(pdfPath)) throw new Error('Excel không xuất được PDF');
    await printer.print(pdfPath, { printer: PRINTER_NAME });
    console.log(`[${new Date().toISOString()}] KHSX (${KHSX_SHEET[job.type]}) → ${PRINTER_NAME}`);
  } finally {
    try { unlinkSync(xlsxPath); } catch {}
    try { unlinkSync(pdfPath); } catch {}
  }
}

// -----------------------------------------------------------
// DCCD: ủy quyền cho app chính in GDI (localhost + token, ref 'saeji|gj|copies')
// -----------------------------------------------------------
async function printDccd(job) {
  if (!MAIN_APP_URL || !MAIN_APP_TOKEN) {
    throw new Error('Thiếu MAIN_APP_URL / MAIN_APP_TOKEN trong .env');
  }
  const [saeji, gj, copies, mc] = String(job.ref_id).split('|');
  const body = new URLSearchParams({ saeji, gj: gj || '10', copies: copies || '1' });
  if (mc) body.set('mc', mc);   // chỉ thị nhiều máy: MC = máy user chọn (13/7)
  const res = await fetch(`${MAIN_APP_URL}/planning/phieu-cd/print-local`, {
    method: 'POST',
    headers: {
      'X-Agent-Token': MAIN_APP_TOKEN,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const d = await res.json().catch(() => null);
  if (!res.ok || !d || d.ok !== true) {
    throw new Error((d && (d.detail || d.error)) || `App chính HTTP ${res.status}`);
  }
  console.log(
    `[${new Date().toISOString()}] DCCD ${d.saeji} máy ${d.machine || '?'} → ${d.printer}`,
  );
}

// -----------------------------------------------------------
// Catalog chỉ thị mở (gợi ý In phiếu DCCD theo mã hàng) — kéo từ app chính
// (localhost+token) đẩy lên app tăng ca mỗi 10 phút
// -----------------------------------------------------------
const CATALOG_MS = 10 * 60_000;
let lastCatalogAt = 0;
let lastCoLotsAt = 0;   // Sản lượng CO (05/10/2026)
let lastCoSyncAt = 0;
let lastCoLotsFp = '';
let lastAbLotsFp = '';   // catalog LOT A/B công đoạn 84 (06/10/2026)
const CO_SWEEP_AT = '07:00';   // vét phiếu Sản lượng CO quên Gửi của ngày trước (anh Hữu 05/10/2026)
let coSweepStartDone = false;  // vét 1 lần lúc agent khởi động (máy mở trễ)
let coSweptDay = '';           // ngày đã vét mốc 07:00

async function pushDccdCatalog() {
  if (!MAIN_APP_URL || !MAIN_APP_TOKEN) return;
  const res = await fetch(`${MAIN_APP_URL}/planning/phieu-cd/lots-all-local`, {
    headers: { 'X-Agent-Token': MAIN_APP_TOKEN },
  });
  if (!res.ok) throw new Error(`lots-all-local HTTP ${res.status}`);
  const d = await res.json();
  ghiNhanGoi('vercel');
  const up = await fetch(`${APP_URL}/api/dccd-lots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `session=${sessionCookie}` },
    body: JSON.stringify(d),
  });
  if (!up.ok) throw new Error(`push catalog HTTP ${up.status}`);
  console.log(`[${new Date().toISOString()}] Catalog DCCD: ${d.lots?.length ?? 0} chỉ thị`);
}

// -----------------------------------------------------------
// XUẤT / TRẢ KHO NPL (28/7) — cầu nối 2 chiều app tăng ca ↔ app chính.
//
//   ① đẩy TỒN app chính → app tăng ca (chỉ khi tồn ĐỔI, so bằng stock-version)
//   ② kéo PHIẾU app tăng ca → app chính (thành phiếu chờ duyệt)
//   ③ kéo TRẠNG THÁI app chính → app tăng ca (đã duyệt / bị từ chối + lý do)
//
// ⚠ Agent KHÔNG bao giờ tự trừ tồn. Tồn chỉ đổi khi người bấm Duyệt trên app
// chính. Spec: hsb-material-app/docs/SPEC_OT_XUAT_TRA_KHO.md
// -----------------------------------------------------------
const NVL_SYNC_MS = 60_000;          // nhịp kiểm tra phiếu + trạng thái
const NVL_HEAVY_MS = 6 * 3600_000;   // phần nặng (cuộn ở line + master) — 6 giờ/lần
// Giờ VÉT phiếu nhân viên quên bấm Gửi (user đổi 16:15 → 16:30 ngày 28/7).
// ⚠ PC tắt lúc 16h30 nên vòng vét có thể không kịp chạy — lúc đó phiếu nằm chờ
// và được vét khi bật PC sáng hôm sau (`!sweepOnStartDone`), đúng ý user.
// Phiếu ĐÃ GỬI thì không bị vét: vòng vét chỉ lấy phiếu `draft` + `synced_at`
// còn trống, phiếu đã gửi mang trạng thái pending/approved.
const SWEEP_AT = '16:30';
let lastNvlSyncAt = 0;
let lastStockVersion = null;
let lastHeavyAt = 0;
// Phiên bản CẤU TRÚC payload lần cuối đã đẩy phần nặng (chuỗi 'vN' đầu
// stock-version). Đổi cấu trúc payload thì phần nặng cũng phải đẩy lại NGAY,
// không chờ hết 6 giờ — nếu không tab Trả kho vẫn dùng dữ liệu cũ thiếu field
// (đã dính 28/7: nvl_main có received_at mà nvl_line thì không).
let lastHeavyVer = null;
let sweptToday = '';                 // 'YYYY-MM-DD' đã vét rồi thì thôi
let sweepOnStartDone = false;        // sáng bật PC: vét 1 lần
const nvlPushed = new Map();         // uid → dấu vân tay trạng thái đã đẩy về OT

function vnNow() {
  return new Date(Date.now() + 7 * 3600 * 1000);
}
function vnDate() {
  return vnNow().toISOString().slice(0, 10);
}
function vnHHMM() {
  return vnNow().toISOString().slice(11, 16);
}

async function mainGet(path) {
  const res = await fetch(`${MAIN_APP_URL}${path}`, {
    headers: { 'X-Agent-Token': MAIN_APP_TOKEN },
  });
  if (!res.ok) throw new Error(`app chính ${path} HTTP ${res.status}`);
  return res.json();
}

async function otFetch(path, init = {}) {
  // ⚠ Đếm PHẢI nằm TRONG doIt vì doIt được gọi lại khi gặp 401 (login lại rồi thử
  // lần hai) — đặt ngoài thì đếm thiếu. Và phải là khối `{ … return … }`: viết
  // arrow không ngoặc rồi chèn thêm câu lệnh thì câu đầu thành thân hàm, hàm trả
  // về undefined, và `res.status` ở dưới nổ "Cannot read properties of undefined".
  // Đúng lỗi đã xảy ra thật lúc 16:47 ngày 07/08/2026.
  const doIt = () => {
    ghiNhanGoi('vercel');
    return fetch(`${APP_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Cookie: `session=${sessionCookie}`,
      },
    });
  };
  let res = await doIt();
  if (res.status === 401) {
    await login();
    res = await doIt();
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`app tăng ca ${path} HTTP ${res.status} ${t.slice(0, 120)}`);
  }
  return res.json();
}

/** ① Đẩy tồn — phần nhẹ (cuộn kho Main + phụ liệu) mỗi khi tồn đổi;
 *  phần nặng (cuộn đang ở line + master NVL) thưa hơn vì gần như không đổi. */
async function pushNvlStock(force = false) {
  const { version } = await mainGet('/api/ot/stock-version');
  const payloadVer = String(version || '').split('|')[0];   // 'v2'
  const heavyDue =
    force || payloadVer !== lastHeavyVer || Date.now() - lastHeavyAt > NVL_HEAVY_MS;
  if (version === lastStockVersion && !heavyDue) return;

  const light = await mainGet('/api/ot/stock?include=main');
  await otFetch('/api/nvl-stock', {
    method: 'POST',
    body: JSON.stringify({ part: 'nvl_main', payload: light.nvl.coils, n: light.nvl.n_main }),
  });
  const aux = await mainGet('/api/ot/stock?branch=aux');
  await otFetch('/api/nvl-stock', {
    method: 'POST',
    body: JSON.stringify({ part: 'aux', payload: aux.aux.materials, n: aux.aux.n }),
  });
  // Cuộn ĐANG Ở LINE = nguồn chọn của tab TRẢ KHO ⇒ phải theo kịp tồn, KHÔNG để
  // nhịp 6 giờ (rà 28/7: 8 cuộn vừa xuất 18:06 chưa có trong danh sách trả, còn
  // cuộn đã trả thì vẫn nằm đó tới 6 tiếng). Đo lại 07/08/2026: gói này nay 358,7 KB (phình theo số cuộn ở line), tồn đổi
  // ~2 lần/ngày ⇒ thêm ~0,5 MB/ngày, không đáng kể so với quota 5 GB.
  const line = await mainGet('/api/ot/stock?branch=nvl&include=line');
  await otFetch('/api/nvl-stock', {
    method: 'POST',
    body: JSON.stringify({ part: 'nvl_line', payload: line.nvl.line_coils, n: line.nvl.n_line }),
  });
  // Mã NVL trong KHSX HÔM NAY (user 30/7) — điện thoại cảnh báo khi xuất NVL
  // ngoài kế hoạch. Payload bọc MẢNG 1 phần tử cho khớp cache localStorage.
  // stock-version đã kèm id KHSX nên đồng bộ KHSX giữa ngày là đẩy lại liền.
  // ⚠ Bọc try riêng: part phụ, lỗi (vd chưa chạy migration 21 nới CHECK part)
  // KHÔNG được chặn cập nhật version — không thì cả gói tồn bị đẩy lại mỗi 60".
  let extra = ` + ${line.nvl.n_line} cuộn ở line`;
  try {
    const kh = await mainGet('/api/ot/khsx-nvl');
    await otFetch('/api/nvl-stock', {
      method: 'POST',
      body: JSON.stringify({
        part: 'nvl_khsx',
        payload: [{ date: kh.date, has_data: kh.has_data, codes: kh.codes }],
        n: (kh.codes || []).length,
      }),
    });
    extra += ` + ${(kh.codes || []).length} mã KHSX`;
  } catch (e) {
    console.error(
      `[${new Date().toISOString()}] Part nvl_khsx lỗi (chưa chạy migration 21?): ${e.message}`,
    );
  }
  // Master NVL gần như bất động → giữ nhịp 6 giờ.
  if (heavyDue) {
    const heavy = await mainGet('/api/ot/stock?branch=nvl&include=master');
    await otFetch('/api/nvl-stock', {
      method: 'POST',
      body: JSON.stringify({ part: 'nvl_master', payload: heavy.nvl.materials, n: heavy.nvl.materials.length }),
    });
    lastHeavyAt = Date.now();
    lastHeavyVer = payloadVer;
    extra += ` + ${heavy.nvl.materials.length} mã master`;
  }
  lastStockVersion = version;
  console.log(
    `[${new Date().toISOString()}] Tồn → app tăng ca: ${light.nvl.n_main} cuộn main` +
      ` + ${aux.aux.n} mã PL${extra}`,
  );
}

/** ② Kéo phiếu lên app chính.
 *  sweep = 'eod'   → vét HẾT phiếu nháp (mốc 16:30 — kể cả phiếu hôm nay)
 *  sweep = 'start' → vét CHỈ phiếu nháp ngày TRƯỚC hôm nay (sáng bật PC vét bù
 *                    hôm qua). Agent restart giữa ngày KHÔNG được gửi sớm phiếu
 *                    nháp trong ngày — đã dính 2 lần (29-30/7) làm tách phiếu. */
// ─────────────────────────────────────────────────────────────────────────────
// CỬA KIỂM — hỏi THẲNG Supabase "có phiếu nào chưa đẩy không?" (07/08/2026)
//
// Vì sao: câu hỏi này chạy 1.548 lần/ngày để bắt ~2 phiếu thật (tỷ lệ 725:1),
// và mỗi lần đi vòng agent → Vercel → Supabase → Vercel → agent. Nhưng dữ liệu
// nằm ở Supabase; Vercel chỉ làm người đưa thư mà mỗi chuyến tính vào hạn mức
// 4 giờ. Hỏi thẳng Supabase thì chuyến đó **miễn phí**.
//
// ⚠ Điều kiện lọc PHẢI khớp Y HỆT `app/api/nvl-slips/sync/route.ts`:
//      vòng thường : .eq('status','pending').is('synced_at', null)
//      vòng vét    : thêm .eq('status','draft').is('synced_at', null)
//   Lệch một chữ là hoặc bỏ sót phiếu, hoặc cửa mở suốt ngày (anh Cường để một
//   phiếu NHÁP chưa gửi thì cửa vẫn phải ĐÓNG ở vòng thường — đúng như route).
//
// ⚠ HỎNG THÌ MỞ, KHÔNG ĐÓNG. Supabase không trả lời → coi như "có việc" → gọi
//   Vercel y như hôm nay. Xấu nhất = không tệ hơn hiện tại, KHÔNG BAO GIỜ mất phiếu.
async function coPhieuChuaDay(sweep) {
  if (!SB_ON) return true;                       // thiếu cấu hình → đi đường cũ
  const dk = sweep
    ? 'status=in.(pending,draft)'
    : 'status=eq.pending';
  try {
    const res = await sb(`nvl_day_slips?${dk}&synced_at=is.null&select=uid&limit=1`);
    return ((await res.json()) || []).length > 0;
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Cửa kiểm phiếu lỗi (mở cửa): ${e.message}`);
    return true;
  }
}

async function pushNvlSlips(sweep) {
  // Không có phiếu nào chờ ⇒ khỏi làm phiền Vercel. Đây là chỗ cắt 774 lượt/ngày.
  if (!(await coPhieuChuaDay(sweep))) return;
  let qs = '';
  if (sweep === 'eod') qs = '?sweep=1';
  else if (sweep === 'start') qs = `?sweep=1&before=${vnDate()}`;
  const { slips } = await otFetch(`/api/nvl-slips/sync${qs}`);
  if (!slips || slips.length === 0) return;
  for (const s of slips) {
    if (!s.lines || s.lines.length === 0) {
      // Không thể xảy ra qua đường bình thường (POST /api/nvl-slips chặn phiếu
      // rỗng). Bỏ qua IM LẶNG là giấu một bất thường — in ra để còn thấy được.
      console.error(
        `[${new Date().toISOString()}] Phiếu ${s.uid} KHÔNG có dòng nào — bỏ qua, thử lại vòng sau`,
      );
      continue;
    }
    const res = await fetch(`${MAIN_APP_URL}/api/ot/slip`, {
      method: 'POST',
      headers: { 'X-Agent-Token': MAIN_APP_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: s.uid,
        slip_date: s.slip_date,
        kind: s.kind,
        branch: s.branch,
        seq: s.seq,
        sender: s.created_by_name,
        sent_at: s.sent_at,
        note: s.note,
        lines: s.lines.map((l) => ({ ...l, qty: l.qty })),
      }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok || !d?.ok) {
      // 422 = phiếu sai (vd đã duyệt rồi) → ghi ngược lý do để nhân viên thấy
      const detail = d?.detail || `app chính HTTP ${res.status}`;
      // ⚠ 422 là PHÁN QUYẾT NGHIỆP VỤ — đẩy lại cũng nhận đúng câu đó ⇒ đóng dấu
      //   đã-đồng-bộ, cho phiếu rời hàng đợi. MỌI mã khác (500, 502, 401…) là
      //   trục trặc NHẤT THỜI của app chính ⇒ phải GIỮ PHIẾU LẠI để vòng sau đẩy
      //   tiếp. Thiếu chốt này thì một cú 500 làm phiếu biến mất vĩnh viễn khỏi
      //   app chính trong khi điện thoại vẫn báo 'đã gửi' (rà soát 14/08/2026,
      //   xem chú thích dài ở `app/api/nvl-slips/sync/route.ts`).
      const tamThoi = res.status !== 422;
      await otFetch('/api/nvl-slips/sync', {
        method: 'POST',
        body: JSON.stringify({
          uid: s.uid,
          line_errors: [{ seq: 0, error: detail }],
          keep_queued: tamThoi,
        }),
      });
      console.error(
        `[${new Date().toISOString()}] Phiếu ${s.uid} bị từ chối nhận: ${detail}`
        + (tamThoi ? ' — GIỮ trong hàng đợi, sẽ thử lại' : ' — lỗi nghiệp vụ, ngừng đẩy'),
      );
      continue;
    }
    await otFetch('/api/nvl-slips/sync', {
      method: 'POST',
      body: JSON.stringify({
        uid: s.uid,
        status: 'pending',
        sent_at: new Date().toISOString(),
        line_errors: d.line_errors ?? [],
      }),
    });
    console.log(
      `[${new Date().toISOString()}] Phiếu ${s.uid} → app chính: ${d.n_lines} dòng` +
        (d.n_err ? `, ${d.n_err} dòng lỗi` : ''),
    );
  }
}

/** ③ Trạng thái app chính → app tăng ca (đã duyệt / từ chối + số phiếu thật). */
async function pullNvlStatuses() {
  const { slips } = await mainGet('/api/ot/slips?days=7');
  for (const s of slips ?? []) {
    // 'draft' = app chính đã XOÁ phiếu thật → phiếu quay về "như chưa gửi"
    if (!['approved', 'rejected', 'draft'].includes(s.status)) continue;
    // Chỉ đẩy khi TRẠNG THÁI ĐỔI — không thì mỗi 60 giây lại ghi đè y nguyên cho
    // mọi phiếu 7 ngày gần đây (đúng lỗi đã dính hôm nay ở chiều ngược lại).
    const mark = [s.status, s.reject_reason || '', s.sys_note || '',
                  (s.refs ?? []).map((r) => r.no).join(',')].join('|');
    if (nvlPushed.get(s.uid) === mark) continue;
    try {
      await otFetch('/api/nvl-slips/sync', {
        method: 'POST',
        body: JSON.stringify({
          uid: s.uid,
          status: s.status,
          main_refs: s.refs ?? [],
          reject_reason: s.reject_reason ?? null,
          // Cảnh báo hệ thống (phiếu thật bị xoá/sửa) → hiện đỏ trên điện thoại
          sys_note: s.sys_note ?? null,
          approved_at: s.approved_at,
          approved_by: s.approved_by,
        }),
      });
      nvlPushed.set(s.uid, mark);
      console.log(
        `[${new Date().toISOString()}] Trạng thái ${s.uid} → app tăng ca: ${s.status}` +
          (s.sys_note ? ' (kèm cảnh báo)' : ''),
      );
    } catch {
      /* phiếu tạo thẳng bên app chính thì không có bên OT — bỏ qua */
    }
  }
}

// -----------------------------------------------------------
// TĂNG CA → app chính, menu Overtime (29/7) — một chiều, CHỈ ĐỌC bên OT.
//
// Dò dấu vân tay (~150 B) mỗi 60" qua /api/overtime-export?meta=1; ĐỔI mới kéo
// bản đầy đủ (người × ngày, đã tính giờ bằng luật của bảng in — agent và app
// chính KHÔNG tính lại giờ) rồi đẩy vào app chính. App chính chỉ ghi đè phần
// trong vùng phủ 30 ngày, phần cũ hơn là kho lưu vĩnh viễn của nó.
//
// Chưa chạy migration 19 (hàm overtime_fingerprint) → fp=null → hạ nhịp kéo
// 30 phút/lần để không phí quota, vẫn đồng bộ được.
// -----------------------------------------------------------
const OT_SYNC_MS = 60_000;
const OT_FALLBACK_MS = 30 * 60_000;
let lastOtSyncAt = 0;
let lastOtFp = null;      // RAM — agent restart thì kéo lại 1 lần (rẻ, vô hại)
let lastOtPullAt = 0;
let otNoFpWarned = false;

/** Lấy dấu vân tay tăng ca — THẲNG từ Supabase thay vì qua Vercel (07/08/2026).
 *
 * Route `/api/overtime-export?meta=1` của Vercel **không làm gì khác** ngoài gọi
 * đúng hàm `overtime_fingerprint()` này rồi chuyển tiếp kết quả. Đã đối chiếu
 * thật cùng thời điểm: Supabase trả `de7bb629d4ec0aec093138b6c453da8a`, Vercel
 * cũng trả `de7bb629d4ec0aec093138b6c453da8a` — GIỐNG HỆT.
 *
 * Trả `null` nếu không lấy được → gọi lại đường Vercel cũ (hỏng thì mở, không đóng).
 */
async function vanTayTangCaTuSupabase() {
  if (!SB_ON) return null;
  try {
    const res = await sb('rpc/overtime_fingerprint', { method: 'POST', body: '{}' });
    const fp = await res.json();
    return typeof fp === 'string' && fp ? fp : null;
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Vân tay tăng ca lỗi (dùng đường Vercel): ${e.message}`);
    return null;
  }
}

async function syncOvertimeOnce() {
  if (!MAIN_APP_URL || !MAIN_APP_TOKEN) return;

  // Cửa kiểm: hỏi Supabase trước. Vân tay KHÔNG đổi ⇒ khỏi gọi Vercel.
  // Đây là chỗ cắt 774 lượt/ngày còn lại.
  const fpSb = await vanTayTangCaTuSupabase();
  if (fpSb !== null) {
    if (fpSb === lastOtFp) return;                 // không đổi → dừng, 0 lượt Vercel
    // Có đổi → rơi xuống dưới, kéo gói đầy đủ qua Vercel như cũ.
  } else {
    // Không hỏi được Supabase → giữ nguyên đường cũ: hỏi ?meta=1 qua Vercel.
    ghiNhanGoi('vercel');
    const metaRes = await fetch(`${APP_URL}/api/overtime-export?meta=1`, {
      headers: { Authorization: `Bearer ${AGENT_SECRET}` },
    });
    if (!metaRes.ok) throw new Error(`overtime meta HTTP ${metaRes.status}`);
    const metaCu = await metaRes.json();
    const dueCu = metaCu.fp
      ? metaCu.fp !== lastOtFp
      : Date.now() - lastOtPullAt > OT_FALLBACK_MS;
    if (!dueCu) return;
  }

  // ⚠ Tới được đây nghĩa là ĐÃ quyết định phải kéo — cả hai nhánh trên đều đã
  // `return` khi không cần. TUYỆT ĐỐI không đánh giá lại điều kiện ở đây: bản
  // nháp đầu của tôi giữ lại khối `let due = …` cũ, và khi đường Supabase hỏng
  // (fpSb = null) nó rơi vào nhánh `OT_FALLBACK_MS` rồi `return` — nuốt mất lần
  // kéo mà nhánh trên vừa xác định là CẦN. Lỗi im lặng, không log gì.
  const meta = { fp: fpSb };
  otNoFpWarned = false;

  ghiNhanGoi('vercel');
  const res = await fetch(`${APP_URL}/api/overtime-export`, {
    headers: { Authorization: `Bearer ${AGENT_SECRET}` },
  });
  if (!res.ok) throw new Error(`overtime export HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`overtime export: ${data.error}`);

  const up = await fetch(`${MAIN_APP_URL}/api/ot/overtime-sync`, {
    method: 'POST',
    headers: { 'X-Agent-Token': MAIN_APP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const d = await up.json().catch(() => null);
  if (!up.ok || !d?.ok) {
    throw new Error((d && d.detail) || `app chính overtime-sync HTTP ${up.status}`);
  }
  lastOtFp = data.fp ?? meta.fp ?? null;
  lastOtPullAt = Date.now();
  console.log(
    `[${new Date().toISOString()}] Overtime → app chính: ${d.n_rows} ô người-ngày` +
      ` (vùng phủ từ ${data.coverage_start}, giữ nguyên ${d.n_kept_older} ô cũ hơn)`,
  );
}

// -----------------------------------------------------------
// SẢN LƯỢNG COATING (anh Hữu 05/10/2026)
//   pushCoLots  — mỗi 10': app chính /api/ot/co-lots (LOT xi mạ CĐ 80, 120 ngày) → app tăng ca /api/co-lots
//                 + A/B công đoạn 84 (06/10/2026): /api/ot/co-lots?stage=84 → /api/co-lots?stage=84 (mã A/B app chính tự lấy ERP)
//   syncCoOnce  — mỗi 60": app tăng ca /api/co-days/sync (phiếu đã Gửi + phiếu ngày cũ quên Gửi)
//                 → app chính /api/ot/co-day (lưu vĩnh viễn) → ghi kết quả ngược về app tăng ca
// Lỗi chỉ ghi log, KHÔNG làm chết vòng in.
// -----------------------------------------------------------
// ── Cửa kiểm Sản lượng CO hỏi THẲNG Supabase (05/10/2026) — y bài học 07/08: Vercel chỉ là người đưa thư,
//    mỗi chuyến tính vào hạn mức Free; không có việc thì KHÔNG gọi Vercel. HỎNG THÌ MỞ (coi như có việc).
async function coCoPhieuCanDay(sweep) {
  if (!SB_ON) return true;
  try {
    const q = sweep
      ? `or=(and(status.eq.pending,synced_at.is.null),and(status.eq.draft,work_date.lt.${vnDate()}))`
      : 'status=eq.pending&synced_at=is.null';
    const res = await sb(`co_day_slips?${q}&select=uid&limit=1`);
    return ((await res.json()) || []).length > 0;
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Cửa kiểm Sản lượng CO lỗi (mở cửa): ${e.message}`);
    return true;
  }
}

async function coCoHangChoXoa() {
  if (!SB_ON) return true;
  try {
    ghiNhanGoi('supabase');
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/info/plan-files/co-deleted.json`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    if (res.status === 404 || res.status === 400) return false;   // chưa từng có hàng chờ
    if (!res.ok) return true;
    const j = await res.json().catch(() => null);
    const size = Number(j?.size ?? j?.metadata?.size ?? 99);
    return size > 2;                                                 // '[]' = 2 byte = rỗng
  } catch { return true; }
}

let coCodesCache = null, coCodesAt = 0;   // danh sách mã Coating: hỏi app tăng ca tối đa 1 lần/giờ

async function pushCoLots() {
  if (!MAIN_APP_URL || !MAIN_APP_TOKEN) return;
  // Danh sách mã Coating lấy từ app tăng ca (lib/co-items.ts) — sửa 1 chỗ (05/10/2026)
  if (!coCodesCache || Date.now() - coCodesAt > 3600_000) {
    const ci = await otFetch('/api/co-items');
    coCodesCache = ((ci && ci.codes) || []).join(','); coCodesAt = Date.now();
  }
  const codes = coCodesCache;
  const data = await mainGet(`/api/ot/co-lots?codes=${encodeURIComponent(codes)}`);
  if (!data || !data.ok) throw new Error((data && data.detail) || 'app chính co-lots lỗi');
  if (!data.lots.length && !codes) throw new Error('app tăng ca chưa có danh sách mã Coating');
  // Chỉ đẩy khi danh sách LOT ĐỔI (≈1 MB) — tiết kiệm hạn mức Supabase/Vercel Free
  const fp = `${codes}|${data.count}|${JSON.stringify(data.lots[0] ?? '')}|${data.lots.reduce((a, l) => a + (Array.isArray(l) ? l[4] : l.kg), 0).toFixed(1)}`;
  if (fp !== lastCoLotsFp) {
    await otFetch('/api/co-lots', { method: 'POST', body: JSON.stringify(data) });
    lastCoLotsFp = fp;
    console.log(`[${new Date().toISOString()}] Catalog LOT xi mạ → app tăng ca: ${data.count} lot`);
  }
  // A/B (CĐ 84): danh sách nhỏ, cũng chỉ đẩy khi đổi
  const ab = await mainGet('/api/ot/co-lots?stage=84');
  if (!ab || !ab.ok) throw new Error((ab && ab.detail) || 'app chính co-lots A/B lỗi');
  const fpAb = `${ab.items.map((i) => i.join(':')).join(',')}|${ab.count}|${JSON.stringify(ab.lots[0] ?? '')}`;
  if (fpAb !== lastAbLotsFp) {
    await otFetch('/api/co-lots?stage=84', { method: 'POST', body: JSON.stringify(ab) });
    lastAbLotsFp = fpAb;
    console.log(`[${new Date().toISOString()}] Catalog LOT A/B → app tăng ca: ${ab.count} lot, ${ab.items.length} mã`);
  }
}

async function syncCoOnce() {
  if (!MAIN_APP_URL || !MAIN_APP_TOKEN) return;
  // Xoá ở APP TĂNG CA → báo app chính xoá theo (anh Hữu 05/10/2026)
  const q = (await coCoHangChoXoa()) ? await otFetch('/api/co-days/deleted') : { items: [] };
  for (const it of (q && q.items) || []) {
    const res = await fetch(`${MAIN_APP_URL}/api/ot/co-day-delete`, {
      method: 'POST', headers: { 'X-Agent-Token': MAIN_APP_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: it.uid, by: it.by }),
    });
    const d = await res.json().catch(() => null);
    if (res.ok && d && d.ok) {
      await otFetch('/api/co-days/deleted', { method: 'POST', body: JSON.stringify({ uid: it.uid }) });
      console.log(`[${new Date().toISOString()}] Sản lượng CO ${it.work_date}: app tăng ca xoá → app chính đã xoá theo`);
    } else {
      console.error(`[${new Date().toISOString()}] Xoá Sản lượng CO ${it.work_date} sang app chính lỗi: ${(d && d.detail) || res.status}`);
    }
  }
  // App chính đã XOÁ phiếu → trả về app tăng ca ('Đang ghi'), rồi xác nhận với app chính (anh Hữu 05/10/2026)
  const del = await mainGet('/api/ot/co-day-deleted');
  for (const it of (del && del.items) || []) {
    await otFetch('/api/co-days/sync', { method: 'POST', body: JSON.stringify({ uid: it.uid, returned: true, returned_by: it.deleted_by }) });
    await fetch(`${MAIN_APP_URL}/api/ot/co-day-deleted/ack`, {
      method: 'POST', headers: { 'X-Agent-Token': MAIN_APP_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: it.uid }),
    });
    console.log(`[${new Date().toISOString()}] Sản lượng CO ${it.work_date}: app chính đã xoá → trả về app tăng ca`);
  }
  // Vét phiếu NGÀY TRƯỚC quên Gửi (anh Hữu 05/10/2026): CHỈ lúc agent vừa khởi động (máy mở) hoặc từ 07:00,
  // mỗi ngày 1 lần. Không vét 16:30 vì Coating tăng ca tới 19:30 mà máy tắt sau 16:30.
  const coToday = vnDate();
  const coSweep = !coSweepStartDone || (vnHHMM() >= CO_SWEEP_AT && coSweptDay !== coToday);
  const { slips } = (await coCoPhieuCanDay(coSweep))
    ? await otFetch(`/api/co-days/sync${coSweep ? '?sweep=1' : ''}`)
    : { slips: [] };
  for (const s of slips || []) {
    const payload = { uid: s.uid, work_date: s.work_date, stage: s.stage || '86', sent_by_name: s.sent_by_name, note: s.note, lines: s.lines };
    let ok = false, detail = '', mainRef = null;
    try {
      const res = await fetch(`${MAIN_APP_URL}/api/ot/co-day`, {
        method: 'POST',
        headers: { 'X-Agent-Token': MAIN_APP_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => null);
      ok = res.ok && !!d?.ok; detail = (d && d.detail) || `HTTP ${res.status}`; mainRef = d?.id ? String(d.id) : null;
    } catch (e) { detail = e.message; }
    await otFetch('/api/co-days/sync', { method: 'POST', body: JSON.stringify({ uid: s.uid, ok, main_ref: mainRef, error: ok ? undefined : detail }) });
    console.log(`[${new Date().toISOString()}] Sản lượng ${s.stage === '84' ? 'AB' : 'CO'} ${s.work_date} (${s.lines.length} dòng${s.swept ? ', vét quên gửi' : ''}) → app chính: ${ok ? 'OK' : 'LỖI ' + detail}`);
  }
  // Chỉ đánh dấu đã vét SAU khi vòng chạy xong (lỗi giữa chừng → vòng 60" sau vét lại, như bài học kho NPL 15/09)
  if (coSweep) {
    coSweepStartDone = true;
    if (vnHHMM() >= CO_SWEEP_AT) coSweptDay = coToday;
    console.log(`[${new Date().toISOString()}] Vét phiếu Sản lượng CO quên Gửi (${coSweptDay === coToday ? '07:00' : 'khởi động'}) xong`);
  }
}

// ── NHẬP LIỆU GIA CÔNG 70/80 (anh Hữu chốt 14/10/2026) ─────────────────────────────────────────────
// Điện thoại (qlsx) lập phiếu đặt / nhập gia công → bảng gc_slips → agent đẩy sang APP CHÍNH /api/ot/gc-phieu
// (huu duyệt, Đẩy ERP) → trạng thái agent ghi ngược về gc_slips. Danh sách chỉ thị chờ đặt + thùng chờ về: agent đẩy
// 1 file plan-files/gc-guong.json (Storage) CHỈ KHI ĐỔI. Mục tiêu anh chốt: mọi chỉ số gói Free < 50 % ⇒
//   · nhận phiếu qua REALTIME (lọc status=pending) — không hỏi dày; lưới dự phòng 30 phút (giờ làm)
//   · ghi ngược synced_at / trạng thái THẲNG Supabase (không qua Vercel), chỉ khi trạng thái đổi
//   · trạng thái duyệt đọc từ app chính trên máy này (không tốn gói Free)
// CÔNG TẮC GC_ON=1 trong .env — CHỈ bật SAU khi anh chạy docs/sql/26-gia-cong.sql (chưa có bảng trong publication
// mà đăng ký Realtime → kênh lỗi → cả luồng lệnh in quay về hỏi 10 giây).
const GC_ON = process.env.GC_ON === '1' && SB_ON;
const GC_GUONG_MS = 10 * 60_000;
const GC_DU_PHONG_MS = 30 * 60_000;
const GC_TRANG_THAI_MS = 60_000;
let lastGcGuongAt = 0;
let lastGcSyncAt = 0;
let lastGcTtAt = 0;
let coTinGc = false;

// Phần gia công nằm ở gia-cong-sync.mjs (kiểm được bằng thu-gia-cong.mjs); đây chỉ nối vào hàm sẵn có của agent.
const gc = taoGcSync({
  sb: async (path, o = {}) => {
    if (!o.method) return (await sb(path)).json();
    await sb(path, { method: o.method, headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o.body) });
    return null;
  },
  mainGet,
  mainPost: async (path, body) => {
    const r = await fetch(`${MAIN_APP_URL}${path}`, {
      method: 'POST', headers: { 'X-Agent-Token': MAIN_APP_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  },
  upload: async (bucket, path, text) => {
    ghiNhanGoi('supabase');
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'no-cache' },
      body: text,
    });
    if (!r.ok) throw new Error(`đẩy ${path} HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`);
  },
  gioLam: () => gioLamVN(),
  log: (m) => console.log(`[${new Date().toISOString()}] ${m}`),
  logLoi: (m) => console.error(`[${new Date().toISOString()}] ${m}`),
});

async function syncGcVong() {
  if (!GC_ON) return;
  if (Date.now() - lastGcGuongAt > GC_GUONG_MS) {
    try { await gc.dayGuong(); lastGcGuongAt = Date.now(); }
    catch (e) { console.error(`[${new Date().toISOString()}] Gia công gương lỗi: ${e.message}`); lastGcGuongAt = Date.now() - GC_GUONG_MS + 60_000; }
  }
  // Phiếu: có tin Realtime, hoặc Realtime không khoẻ (hỏi 60"), hoặc tới lưới dự phòng 30' trong giờ làm
  const khoe = hub && hub.trangThai().khoe;
  const toiNhip = Date.now() - lastGcSyncAt > (khoe ? GC_DU_PHONG_MS : 60_000) && (gioLamVN() || !khoe);
  if (coTinGc || toiNhip) {
    coTinGc = false;
    lastGcSyncAt = Date.now();
    try { await gc.dayPhieu(); } catch (e) { console.error(`[${new Date().toISOString()}] Gia công đẩy phiếu lỗi: ${e.message}`); }
  }
  if (Date.now() - lastGcTtAt > GC_TRANG_THAI_MS) {
    lastGcTtAt = Date.now();
    try { await gc.keoTrangThai(); } catch (e) { console.error(`[${new Date().toISOString()}] Gia công trạng thái lỗi: ${e.message}`); }
  }
}

async function syncNvlOnce() {
  if (!MAIN_APP_URL || !MAIN_APP_TOKEN) return;
  const today = vnDate();
  // Vét 2 kiểu (user chốt 30/7):
  //   'start' — 1 lần khi agent khởi động: CHỈ phiếu ngày trước (vét bù hôm qua
  //             khi PC tắt trước 16:30). Restart giữa ngày không đụng phiếu hôm nay.
  //   'eod'   — mốc 16:30: vét hết, kể cả phiếu nháp hôm nay.
  let sweep = null;
  if (!sweepOnStartDone) {
    sweep = 'start';
  } else if (vnHHMM() >= SWEEP_AT && sweptToday !== today) {
    sweep = 'eod';
  }
  if (sweep) {
    console.log(`[${new Date().toISOString()}] Vét phiếu chưa gửi (sweep=${sweep})`);
  }
  // ⚠ SỰ CỐ 12/09 + 14/09/2026 — vòng vét CHẾT khi đẩy tồn lỗi, không thử lại:
  //   (1) đẩy tồn ném lỗi (Supabase "Gateway Timeout" đúng 16:30) ⇒ hai bước dưới
  //       không bao giờ chạy; (2) `sweptToday` đã ghi TRƯỚC khi vét ⇒ cả ngày không
  //       vét lại. Phiếu nháp 14/9 nằm im tới sáng 15/9. Trước đó sống được 20 ngày
  //       nhờ PC tắt mỗi tối (sáng bật = vét khởi động bù) — 14/9 PC không tắt.
  //   Chốt (anh Hữu 15/09): đẩy tồn lỗi CHỈ ghi log, vẫn đi tiếp vét phiếu + kéo
  //   trạng thái; dấu "đã vét" chỉ ghi SAU khi vét phiếu xong — hỏng thì vòng 60"
  //   sau vét lại. An toàn gửi trùng: vét luôn chỉ lấy phiếu `synced_at IS NULL`.
  try {
    await pushNvlStock(!!sweep);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Đẩy tồn lỗi (vẫn vét phiếu tiếp): ${e.message}`);
  }
  await pushNvlSlips(sweep);
  if (sweep === 'start') sweepOnStartDone = true;
  else if (sweep === 'eod') sweptToday = today;
  await pullNvlStatuses();
}

// -----------------------------------------------------------
// Phiếu tăng ca GỘP THEO NGÀY (user 15/7): 1 lệnh in = mọi phiếu của ngày
// (HD trước RL). Render TỪNG phiếu bằng đúng trang /registrations/{id}/view
// (bản in y hệt in lẻ) rồi gửi máy in liên tiếp.
// -----------------------------------------------------------
async function printOvertimeSheets(job) {
  const res = await fetch(
    `${APP_URL}/api/registrations/by-date?date=${job.ref_id}`,
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  if (res.status === 401) {
    await login();
    return printOvertimeSheets(job); // retry 1 lần với session mới
  }
  if (!res.ok) throw new Error(`Lấy danh sách phiếu lỗi HTTP ${res.status}`);
  const { registrations } = await res.json();
  if (!registrations || registrations.length === 0) {
    throw new Error(`Ngày ${job.ref_id} không có phiếu tăng ca nào`);
  }
  for (const reg of registrations) {
    const pdf = await renderPDF({ type: 'registration', ref_id: reg.id });
    await printPDFFile(pdf, `${job.id}-${reg.department}`);
    console.log(
      `[${new Date().toISOString()}] Phiếu ${reg.department} ${reg.id.slice(0, 8)} → ${PRINTER_NAME}`,
    );
  }
}

// -----------------------------------------------------------
// Print PDF via Windows
// -----------------------------------------------------------
// Bảng Kết quả Coating ngày (anh Hữu 05/10/2026): in ra ĐÚNG form file Excel tải xuống —
// lấy dòng từ app tăng ca (kể cả phiếu đang ghi) → app chính dựng Excel → PDF (LibreOffice) → máy in.
async function printCoDay(job) {
  // ref_id = 'YYYY-MM-DD' (Coating) hoặc 'YYYY-MM-DD|84' (A/B, 06/10/2026)
  const [date, st] = String(job.ref_id).split('|');
  const stage = st === '84' ? '84' : '86';
  const d = await otFetch(`/api/co-days?date=${date}&stage=${stage}`);
  if (!d || !d.lines || d.lines.length === 0) throw new Error(`Ngày ${date} chưa có dòng Sản lượng ${stage === '84' ? 'AB' : 'CO'} nào`);
  const res = await fetch(`${MAIN_APP_URL}/api/ot/co-day.pdf`, {
    method: 'POST',
    headers: { 'X-Agent-Token': MAIN_APP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ work_date: date, stage, sent_by_name: d.slip?.sent_by_name ?? '', lines: d.lines }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`App chính dựng PDF lỗi HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  await printPDFFile(Buffer.from(await res.arrayBuffer()), job.id);
}

async function printPDFFile(pdfBuffer, jobId) {
  const filepath = join(TMP_DIR, `job-${jobId}.pdf`);
  writeFileSync(filepath, pdfBuffer);
  try {
    await printer.print(filepath, { printer: PRINTER_NAME });
    console.log(`[${new Date().toISOString()}] Sent to printer: ${PRINTER_NAME}`);
  } finally {
    // Xóa file tạm sau khi in
    try {
      unlinkSync(filepath);
    } catch {}
  }
}

// -----------------------------------------------------------
// Main loop
// -----------------------------------------------------------
async function processJob(job) {
  console.log(`\n[${new Date().toISOString()}] Processing job ${job.id.slice(0, 8)}... (type=${job.type})`);
  if (!(await nhanLenh(job.id))) {
    console.log(`[${new Date().toISOString()}] Bỏ qua job ${job.id.slice(0, 8)} — không nhận được (đã có lượt khác nhận / hết hạn / lỗi)`);
    return;
  }
  try {
    if (job.type === 'khsx_tong' || job.type === 'khsx_homnay') {
      await printKhsx(job);
    } else if (job.type === 'dccd') {
      await printDccd(job);
    } else if (job.type === 'overtime_sheets') {
      await printOvertimeSheets(job);
    } else if (job.type === 'co_day') {
      await printCoDay(job);
    } else {
      const pdf = await renderPDF(job);
      await printPDFFile(pdf, job.id);
    }
    await updateJob(job.id, 'done');
    console.log(`[${new Date().toISOString()}] DONE job ${job.id.slice(0, 8)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${new Date().toISOString()}] ERROR job ${job.id.slice(0, 8)}: ${msg}`);
    await updateJob(job.id, 'error', msg.slice(0, 500));
  }
}

async function pollLoop() {
  while (true) {
    // Catalog DCCD mỗi 10' (lỗi → thử lại sau 1')
    if (Date.now() - lastCatalogAt > CATALOG_MS) {
      try {
        await pushDccdCatalog();
        lastCatalogAt = Date.now();
      } catch (e) {
        console.error(`[${new Date().toISOString()}] Catalog lỗi: ${e.message}`);
        lastCatalogAt = Date.now() - CATALOG_MS + 60_000;
      }
    }
    // Xuất/Trả kho NPL mỗi 60" — lỗi KHÔNG được làm chết vòng in
    if (Date.now() - lastNvlSyncAt > NVL_SYNC_MS) {
      try {
        await syncNvlOnce();
      } catch (e) {
        console.error(`[${new Date().toISOString()}] Sync kho NPL lỗi: ${e.message}`);
      }
      lastNvlSyncAt = Date.now();
    }
    // Sản lượng Coating: catalog LOT mỗi 10', phiếu mỗi 60" (anh Hữu 05/10/2026)
    if (Date.now() - lastCoLotsAt > CATALOG_MS) {
      try { await pushCoLots(); lastCoLotsAt = Date.now(); }
      catch (e) { console.error(`[${new Date().toISOString()}] Catalog LOT CO lỗi: ${e.message}`); lastCoLotsAt = Date.now() - CATALOG_MS + 60_000; }
    }
    if (Date.now() - lastCoSyncAt > NVL_SYNC_MS) {
      try { await syncCoOnce(); } catch (e) { console.error(`[${new Date().toISOString()}] Sync Sản lượng CO lỗi: ${e.message}`); }
      lastCoSyncAt = Date.now();
    }
    // Tăng ca → menu Overtime app chính mỗi 60" (dò vân tay, đổi mới kéo)
    if (Date.now() - lastOtSyncAt > OT_SYNC_MS) {
      try {
        await syncOvertimeOnce();
      } catch (e) {
        console.error(`[${new Date().toISOString()}] Sync Overtime lỗi: ${e.message}`);
      }
      lastOtSyncAt = Date.now();
    }
    await syncGcVong();
    canhRealtime();
    // Hỏi lệnh in khi: có tin Realtime / bắt bù, hoặc tới nhịp (xem nhipHoiIn). Tắt Realtime → luôn tới nhịp POLL_MS.
    if (!coTinIn && Date.now() - lanHoiInCuoi < nhipHoiIn()) {
      await choHoacDanhThuc(POLL_MS);
      continue;
    }
    coTinIn = false;
    lanHoiInCuoi = Date.now();
    try {
      const jobs = await pollPendingJobs();
      if (jobs.length > 0) {
        console.log(`[${new Date().toISOString()}] Found ${jobs.length} pending job(s)`);
        // Chỉ xử lý job ĐẦU TIÊN mỗi vòng rồi poll lại ngay — danh sách luôn
        // tươi, job đã tự hủy (quá 2') phía server không bao giờ được in ra.
        await processJob(jobs[0]);
        coTinIn = true;          // hỏi lại ngay vòng sau (còn lệnh khác thì in tiếp)
        continue;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[${new Date().toISOString()}] Poll error: ${msg}`);
      // Nếu 401 → session hết hạn, login lại
      if (msg.includes('401')) {
        try {
          await login();
        } catch (loginErr) {
          console.error('Re-login failed:', loginErr);
        }
      }
    }
    await choHoacDanhThuc(POLL_MS);
  }
}

async function main() {
  console.log(`Hansungbolt Print Agent`);
  console.log(`App: ${APP_URL}`);
  console.log(`Printer: ${PRINTER_NAME}`);
  console.log(`Poll interval: ${POLL_MS}ms`);
  console.log('');

  await login();
  await ensureBrowser();
  if (REALTIME_ON) {
    try {
      hub = taoHub({ url: SUPABASE_URL, key: SUPABASE_SERVICE_KEY, idAgent: 'agent', ghiLog: (m) => console.log(m) });
      const coViec = () => { coTinIn = true; danhThucVong(); };
      hub.dangKy({ bang: 'print_jobs', suKien: 'INSERT', xuLy: coViec, batBu: coViec });
      if (GC_ON) {
        const coGc = () => { coTinGc = true; danhThucVong(); };
        hub.dangKy({ bang: 'gc_slips', suKien: '*', loc: 'status=eq.pending', xuLy: coGc, batBu: coGc });
      }
      await hub.batDau();
      console.log(`Realtime: BẬT — dự phòng lệnh in ${DU_PHONG_IN_MS / 1000} giây trong giờ làm, `
        + `${POLL_MS / 1000} giây khi không khoẻ`);
    } catch (e) {
      hub = null;
      console.error(`Realtime khởi động lỗi — chạy chế độ hỏi mỗi ${POLL_MS} ms: ${e.message}`);
    }
  } else {
    console.log(`Realtime: TẮT (REALTIME_ON khác 1) — hỏi lệnh in mỗi ${POLL_MS} ms như cũ`);
  }
  console.log(`Gia công: ${GC_ON ? 'BẬT (GC_ON=1)' : 'TẮT (GC_ON khác 1 — bật sau khi chạy docs/sql/26-gia-cong.sql)'}`);
  await pollLoop();
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
});

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
