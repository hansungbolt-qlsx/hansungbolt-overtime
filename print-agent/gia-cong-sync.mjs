// NHẬP LIỆU GIA CÔNG 70/80 — phần agent (anh Hữu chốt 14/10/2026). Tách module để KIỂM ĐƯỢC chỗ nối 2 app
// (bài kiểm: print-agent/thu-gia-cong.mjs — Supabase giả + app chính trên bản sao DB).
//
// Điện thoại (qlsx) → bảng gc_slips → agent đẩy sang APP CHÍNH /api/ot/gc-phieu (huu duyệt, Đẩy ERP) → trạng thái
// agent ghi ngược về gc_slips. Danh sách chỉ thị chờ đặt + thùng chờ về: 1 file plan-files/gc-guong.json CHỈ KHI ĐỔI.
// Mục tiêu anh chốt: mọi chỉ số gói Free < 50 % ⇒ nhận phiếu qua Realtime (agent.js), ghi ngược THẲNG Supabase
// (không qua Vercel) và chỉ khi đổi, trạng thái duyệt đọc app chính trên máy này (không tốn gói Free).
import { createHash } from 'crypto';

export function taoGcSync({ sb, mainGet, mainPost, upload, gioLam = () => true, log = console.log, logLoi = console.error }) {
  let fpGuong = '';
  const daBao = new Map();   // uid → 'trạng thái|version' đã ghi về Supabase

  async function dayGuong() {
    if (!gioLam()) return false;
    const d = await mainGet('/api/ot/gc-guong');
    const fp = createHash('sha1').update(JSON.stringify([d.ncc, d.cho_dat, d.cho_ve])).digest('hex');
    if (fp === fpGuong) return false;
    await upload('plan-files', 'gc-guong.json',
      JSON.stringify({ at: new Date().toISOString(), ncc: d.ncc, cho_dat: d.cho_dat, cho_ve: d.cho_ve }));
    fpGuong = fp;
    log(`Gia công: gương ${d.cho_dat.length} chỉ thị chờ đặt · ${d.cho_ve.length} thùng chờ về · ${d.ncc.length} NCC`);
    return true;
  }

  async function dayPhieu() {
    const rows = await sb('gc_slips?status=eq.pending&synced_at=is.null'
      + '&select=uid,loai,cong_doan,ncc,lines,note,created_by_name,sent_at&order=sent_at.asc&limit=20');
    let n = 0;
    for (const s of rows) {
      const payload = { uid: s.uid, loai: s.loai, cong_doan: s.cong_doan, ncc: s.ncc, nguoi_gui: s.created_by_name,
        gui_luc: s.sent_at, ghi_chu: s.note, dong: s.lines };
      const { status, json: j } = await mainPost('/api/ot/gc-phieu', payload);
      const q = `gc_slips?uid=eq.${encodeURIComponent(s.uid)}&status=eq.pending`;   // người dùng đã sửa lại → không đè
      const now = new Date().toISOString();
      if (status === 200 && j.ok) {
        await sb(q, { method: 'PATCH', body: { synced_at: now, last_error: null, main_version: j.version ?? null } });
        log(`Gia công: phiếu ${s.uid} → app chính #${j.id}`);
        n++;
      } else if (status === 422) {             // lỗi nghiệp vụ: trả về điện thoại để sửa, không thử lại
        const ly = `App chính không nhận: ${j.detail || 'dữ liệu không hợp lệ'}`.slice(0, 480);
        await sb(q, { method: 'PATCH', body: { status: 'rejected', reject_reason: ly, last_error: ly, synced_at: now } });
        logLoi(`Gia công: phiếu ${s.uid} bị app chính từ chối: ${ly}`);
      } else {
        logLoi(`Gia công: đẩy ${s.uid} lỗi HTTP ${status} — giữ trong hàng chờ`);
      }
    }
    return n;
  }

  async function keoTrangThai() {
    const d = await mainGet('/api/ot/gc-phieu-trang-thai?ngay=14');
    const MAP = { approved: 'approved', pushing: 'approved', pushed: 'pushed', rejected: 'rejected' };
    let n = 0;
    for (const p of d.phieu || []) {
      const st = MAP[p.trang_thai];
      if (!st) continue;                         // pending: điện thoại đã là 'pending'
      const mark = `${st}|${p.version}`;
      if (daBao.get(p.uid) === mark) continue;
      await sb(`gc_slips?uid=eq.${encodeURIComponent(p.uid)}&status=in.(pending,approved,pushed)`, {
        method: 'PATCH', body: { status: st, reject_reason: p.ly_do_tra ?? null, approved_by: p.duyet_boi ?? null,
          approved_at: p.duyet_luc ?? null, erp_ref: p.erp_ref ?? null, main_version: p.version ?? null } });
      daBao.set(p.uid, mark);
      n++;
    }
    return n;
  }

  return { dayGuong, dayPhieu, keoTrangThai };
}
