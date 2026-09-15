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
const POLL_MS = SB_ON
  ? Math.max(1_000, _pollThoLenh || 3_000)
  : Math.max(15_000, _pollThoLenh || 15_000);
if (POLL_MS !== _pollThoLenh) {
  console.log(`⚠ POLL_INTERVAL_MS="${POLL_INTERVAL_MS}" bị điều chỉnh → dùng ${POLL_MS}ms`
    + (SB_ON ? '' : ' (đường lui qua Vercel — ép sàn 15 giây để giữ hạn mức)'));
}

// TTL 2 phút — PHẢI giữ đúng bằng `lib/print-jobs-expire.ts` bên app.
// Đổi một bên mà quên bên kia là lệnh in hết hạn vẫn chạy ra giấy.
const PRINT_JOB_TTL_MS = 2 * 60_000;

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
// Dọn mỗi 30 giây là đủ (TTL là 2 phút) — chạy mỗi lượt poll thì tốn 3 lượt gọi
// Supabase thay vì 1, mà không sớm hơn được phút nào.
const DON_MOI_MS = 30_000;
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
  const res = await sb(
    'print_jobs?status=eq.pending'
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
    const isLandscape = job.type === 'overtime_summary';
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
  try {
    await updateJob(job.id, 'printing');
    if (job.type === 'khsx_tong' || job.type === 'khsx_homnay') {
      await printKhsx(job);
    } else if (job.type === 'dccd') {
      await printDccd(job);
    } else if (job.type === 'overtime_sheets') {
      await printOvertimeSheets(job);
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
    // Tăng ca → menu Overtime app chính mỗi 60" (dò vân tay, đổi mới kéo)
    if (Date.now() - lastOtSyncAt > OT_SYNC_MS) {
      try {
        await syncOvertimeOnce();
      } catch (e) {
        console.error(`[${new Date().toISOString()}] Sync Overtime lỗi: ${e.message}`);
      }
      lastOtSyncAt = Date.now();
    }
    try {
      const jobs = await pollPendingJobs();
      if (jobs.length > 0) {
        console.log(`[${new Date().toISOString()}] Found ${jobs.length} pending job(s)`);
        // Chỉ xử lý job ĐẦU TIÊN mỗi vòng rồi poll lại ngay — danh sách luôn
        // tươi, job đã tự hủy (quá 2') phía server không bao giờ được in ra.
        await processJob(jobs[0]);
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
    await new Promise((r) => setTimeout(r, POLL_MS));
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
