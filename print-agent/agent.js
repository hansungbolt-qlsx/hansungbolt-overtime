// Print agent for Hansungbolt Overtime
// Chạy trên máy tính admin (có kết nối máy in laser + Internet).
// Poll app mỗi POLL_INTERVAL_MS để lấy job in mới, render PDF, gửi máy in.

import 'dotenv/config';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
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
} = process.env;

// Validate config
const required = { APP_URL, AGENT_SECRET, LOGIN_USERNAME, LOGIN_PASSWORD, PRINTER_NAME };
for (const [k, v] of Object.entries(required)) {
  if (!v) {
    console.error(`Thiếu biến môi trường ${k}. Copy .env.example thành .env rồi điền đầy đủ.`);
    process.exit(1);
  }
}

const POLL_MS = Number(POLL_INTERVAL_MS);
const TMP_DIR = join(tmpdir(), 'hansungbolt-print');
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// -----------------------------------------------------------
// Session management
// -----------------------------------------------------------
let sessionCookie = null;

async function login() {
  console.log(`[${new Date().toISOString()}] Login as ${LOGIN_USERNAME}...`);
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
async function pollPendingJobs() {
  const res = await fetch(`${APP_URL}/api/print-jobs?status=pending`, {
    headers: { Authorization: `Bearer ${AGENT_SECRET}` },
  });
  if (!res.ok) {
    throw new Error(`Poll HTTP ${res.status}`);
  }
  const { jobs } = await res.json();
  return jobs ?? [];
}

async function updateJob(id, status, errorMessage) {
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
  const [saeji, gj, copies] = String(job.ref_id).split('|');
  const body = new URLSearchParams({ saeji, gj: gj || '10', copies: copies || '1' });
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
