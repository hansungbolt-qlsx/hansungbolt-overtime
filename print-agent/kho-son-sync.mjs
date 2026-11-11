// KHO SƠN COATING — phần agent (anh Hữu chốt 11/11/2026). Tách module để KIỂM ĐƯỢC chỗ nối 3 app
// (bài kiểm: print-agent/thu-kho-son.mjs, do app chính scripts/test/kho_son_noi_3_app_verify.py dựng + gọi).
//
// Điện thoại (tổ trưởng Coating) → bảng co_paint_slips → agent đẩy sang APP CHÍNH /api/ot/kho-son/phieu
// → app chính ghi dòng xuất 'XS-…' vào app Coating → agent kéo trạng thái về co_paint_slips (● đã vào app Coating).
// Tồn Main theo lô + Tồn Line: 1 file plan-files/kho-son.json (Storage) CHỈ KHI ĐỔI — điện thoại đọc file này.
// Như gia công: nhận phiếu qua Realtime, ghi ngược THẲNG Supabase và chỉ khi đổi, mọi thứ khác đọc app chính trong LAN.
import { createHash } from 'crypto';

export function taoKsSync({ sb, mainGet, mainPost, upload, gioLam = () => true, log = console.log, logLoi = console.error }) {
  let fpTon = '';
  const daBao = new Map();   // so_phieu → dấu trạng thái đã ghi về Supabase

  async function dayTon() {
    if (!gioLam()) return false;
    const d = await mainGet('/api/ot/kho-son/ton');
    if (!d.ok) return false;                           // app chính chưa đọc được app Coating → giữ file cũ
    const fp = createHash('sha1').update(JSON.stringify([d.san_pham, d.chua_dinh_muc])).digest('hex');
    if (fp === fpTon) return false;
    await upload('plan-files', 'kho-son.json', JSON.stringify({ at: new Date().toISOString(), ...d }));
    fpTon = fp;
    log(`Kho sơn: đẩy tồn ${d.san_pham.length} vật tư (app Coating rev ${d.rev})`);
    return true;
  }

  async function dayPhieu() {
    const rows = await sb('co_paint_slips?synced_at=is.null'
      + '&select=so_phieu,ngay,status,version,lines,history,cancel_reason,created_by_name,sent_at&order=sent_at.asc&limit=20');
    let n = 0;
    for (const s of rows) {
      const payload = { so_phieu: s.so_phieu, version: s.version, ngay: s.ngay, nguoi_tao: s.created_by_name,
        huy: s.status === 'cancelled', ly_do_huy: s.cancel_reason, gui_luc: s.sent_at, lich_su: s.history || [],
        dong: (s.lines || []).map((d) => ({ line_id: d.line_id, product_id: d.product_id, lot_id: d.lot_id, qty: d.qty,
          doi_lo_ly_do: d.doi_lo_ly_do || null, het_han: d.het_han || null })) };
      const { status, json: j } = await mainPost('/api/ot/kho-son/phieu', payload);
      // chỉ đánh dấu ĐÚNG bản vừa gửi: tổ trưởng sửa tiếp (version tăng) thì bản mới vẫn chờ
      const q = `co_paint_slips?so_phieu=eq.${encodeURIComponent(s.so_phieu)}&version=eq.${s.version}`;
      const now = new Date().toISOString();
      if (status === 200 && j.ok) {
        await sb(q, { method: 'PATCH', body: { synced_at: now, last_error: null } });
        log(`Kho sơn: phiếu ${s.so_phieu} v${s.version} → app chính #${j.id}`);
        n++;
      } else if (status === 422) {                     // lỗi nghiệp vụ: hiện trên điện thoại, không thử lại
        const ly = `App chính không nhận: ${j.detail || 'dữ liệu không hợp lệ'}`.slice(0, 480);
        await sb(q, { method: 'PATCH', body: { synced_at: now, last_error: ly } });
        logLoi(`Kho sơn: phiếu ${s.so_phieu} bị app chính từ chối: ${ly}`);
      } else {
        logLoi(`Kho sơn: đẩy ${s.so_phieu} lỗi HTTP ${status} — giữ trong hàng chờ`);
      }
    }
    return n;
  }

  async function keoTrangThai() {
    const d = await mainGet('/api/ot/kho-son/trang-thai?ngay=14');
    let n = 0;
    for (const p of d.phieu || []) {
      const vao = p.coating_version === p.version;
      const loi = p.coating_loi || (p.admin_xoa.length ? `Admin app Coating đã xoá dòng ${p.admin_xoa.join(', ')}` : null);
      const mark = `${p.version}|${vao}|${loi ?? ''}`;
      if (daBao.get(p.so_phieu) === mark) continue;
      const body = { main_version: vao ? p.version : null, last_error: loi };
      // 'pending' → 'synced' khi app Coating đã có bản này; phiếu huỷ giữ 'cancelled'
      await sb(`co_paint_slips?so_phieu=eq.${encodeURIComponent(p.so_phieu)}&version=eq.${p.version}&status=eq.pending`,
        { method: 'PATCH', body: { ...body, ...(vao ? { status: 'synced' } : {}) } });
      await sb(`co_paint_slips?so_phieu=eq.${encodeURIComponent(p.so_phieu)}&version=eq.${p.version}&status=in.(synced,cancelled)`,
        { method: 'PATCH', body });
      daBao.set(p.so_phieu, mark);
      n++;
    }
    return n;
  }

  return { dayTon, dayPhieu, keoTrangThai };
}
