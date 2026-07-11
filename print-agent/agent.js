// Print agent for Hansungbolt Overtime
// Chạy trên máy tính admin (có kết nối máy in laser + Internet).
// Poll app mỗi POLL_INTERVAL_MS để lấy job in mới, render PDF, gửi máy in.

import 'dotenv/config';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import puppeteer from 'puppeteer';
import printer from 'pdf-to-printer';

const {
  APP_URL,
  AGENT_SECRET,
  LOGIN_USERNAME,
  LOGIN_PASSWORD,
  PRINTER_NAME,
  POLL_INTERVAL_MS = '10000',
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
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Đợi thêm 500ms cho font/image load
    await new Promise((r) => setTimeout(r, 500));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '8mm',
        right: '8mm',
        bottom: '8mm',
        left: '8mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close().catch(() => {});
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
    const pdf = await renderPDF(job);
    await printPDFFile(pdf, job.id);
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
        for (const job of jobs) {
          await processJob(job);
        }
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
