// realtime-hub — lõi nhận việc bằng Supabase Realtime cho print-agent (12/10/2026).
// Thiết kế + 8 lớp bảo vệ: docs/realtime-agent-thiet-ke.md. File này lo L1–L5, L7 và đo đếm cho L8;
// L6 (nhận việc nguyên tử) nằm ở chỗ xử lý việc (agent.js · nhanLenh).
//
//   const hub = taoHub({ url, key, idAgent, ghiLog });
//   hub.dangKy({ bang: 'print_jobs', suKien: 'INSERT', xuLy: (payload) => …, batBu: async () => …, gom: 0 });
//   hub.batDau();   hub.trangThai() → { khoe, lyDo, … }   hub.dung()
//
// "Khoẻ" (được tin tưởng để KHÔNG phải hỏi dày) chỉ khi ĐỦ cả 4:
//   (1) kênh SUBSCRIBED  (2) đã nhận tin hệ thống "Subscribed to PostgreSQL" (bài học GĐ1: SUBSCRIBED đến TRƯỚC)
//   (3) nhịp tim gần nhất 'ok' chưa quá 45 giây  (4) canary gần nhất không hỏng.
// Không khoẻ → nơi gọi tự quay về hỏi dày như cũ (xấu nhất = không tệ hơn trước Realtime).
import { createClient } from '@supabase/supabase-js';

const NHIP_TIM_MS = 15_000;          // L1: nhịp tim 15 giây (mặc định thư viện 25 giây)
const NHIP_TIM_QUA_HAN_MS = 45_000;  // L2: quá 45 giây không có nhịp tim 'ok' → không khoẻ
const CANARY_MOI_MS = 10 * 60_000;   // L4: tự kiểm đầu-cuối mỗi 10 phút
const CANARY_CHO_MS = 15_000;        //     phải nhận lại tin trong 15 giây
const LUI_DAN_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];   // L1/L2: nối lại lùi dần

export function taoHub({ url, key, idAgent, ghiLog = console.log, schema = 'public',
  canaryMoiMs = CANARY_MOI_MS, canaryDauMs = 60_000 }) {   // 2 tham số cuối chỉ để bài kiểm rút ngắn thời gian
  const dangKys = [];
  let sb = null;
  let kenh = null;
  let soLanThuLai = 0;
  let henNoiLai = null;
  let henCanary = null;
  let dung = false;
  let theHe = 0;             // mỗi lần mở kênh = 1 thế hệ; báo cáo từ kênh/client CŨ bị bỏ qua (vá vòng lặp 12/10)
  let henOnDinh = null;
  let thuBoQuaTin = false;   // móc thử: giả lập lỗi IM LẶNG (kết nối sống, tin rơi) — chỉ bài kiểm dùng
  const tt = {
    kenh: 'CHUA_KET_NOI', sanSang: false, nhipTimCuoi: 0, nhipTimTrangThai: '',
    canaryCuoi: 0, canaryOk: null, canaryHongLienTiep: 0, canaryCho: null,
    tinNhan: 0, lanNoiLai: 0, lanTaoLaiClient: 0, batDauLuc: Date.now(), khoeTu: 0,
  };

  const log = (m) => ghiLog(`[${new Date().toISOString()}] [realtime] ${m}`);

  function taoClient() {
    sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        heartbeatIntervalMs: NHIP_TIM_MS,
        heartbeatCallback: (s) => {                     // 'sent' | 'ok' | 'error' | 'timeout' | 'disconnected'
          tt.nhipTimTrangThai = s;
          if (s === 'ok') tt.nhipTimCuoi = Date.now();
          if (s === 'timeout' || s === 'error' || s === 'disconnected') log(`nhịp tim: ${s}`);
        },
      },
    });
  }

  function hen(fnMs, fn) { return setTimeout(() => { if (!dung) fn(); }, fnMs); }

  function noiLaiSau(lyDo) {
    if (dung || henNoiLai) return;
    const ms = LUI_DAN_MS[Math.min(soLanThuLai, LUI_DAN_MS.length - 1)];
    soLanThuLai++;
    tt.sanSang = false;
    log(`nối lại sau ${ms / 1000} giây (lý do: ${lyDo})`);
    henNoiLai = hen(ms, async () => { henNoiLai = null; tt.lanNoiLai++; await moKenh(); });
  }

  async function goKenh() {
    // Tăng thế hệ TRƯỚC khi gỡ: kênh cũ sẽ báo 'CLOSED' khi bị gỡ — báo cáo đó phải bị bỏ qua, nếu không
    // hub tưởng kênh MỚI đứt → gỡ → mở → lặp vô hạn mỗi giây (lỗi bắt được ở bài kiểm 12/10/2026).
    theHe++;
    const cu = kenh;
    kenh = null;
    if (cu && sb) { try { await sb.removeChannel(cu); } catch { /* bỏ qua */ } }
  }

  async function moKenh() {
    await goKenh();
    const he = theHe;
    const cu = () => he !== theHe;                 // true = báo cáo của kênh/thế hệ cũ → bỏ qua
    tt.sanSang = false;
    let k = sb.channel(`agent-${idAgent}`);
    k = k.on('system', {}, (m) => {
      if (cu()) return;
      if (m?.extension === 'postgres_changes' && m?.status === 'ok') {
        if (!tt.sanSang) {
          tt.sanSang = true;
          tt.khoeTu = Date.now();
          // Chỉ hạ thời gian chờ nối lại về mức ngắn nhất khi đã ỔN ĐỊNH 60 giây — chập chờn thì chờ lâu dần
          clearTimeout(henOnDinh);
          henOnDinh = hen(60_000, () => { if (!cu() && tt.sanSang) soLanThuLai = 0; });
          log('sẵn sàng (Subscribed to PostgreSQL) → bắt bù việc đang chờ');
          batBuTatCa('sẵn sàng');
        }
      } else if (m?.status && m.status !== 'ok') {
        log(`tin hệ thống lỗi: ${JSON.stringify(m).slice(0, 200)}`);
        noiLaiSau('tin hệ thống lỗi');
      }
    });
    // Canary (L4): nghe chính bảng agent_heartbeat, chỉ dòng của agent này
    k = k.on('postgres_changes', { event: '*', schema, table: 'agent_heartbeat', filter: `id=eq.${idAgent}` }, () => {
      if (cu() || thuBoQuaTin) return;
      if (tt.canaryCho) { tt.canaryCho(); tt.canaryCho = null; }
    });
    for (const d of dangKys) {
      const loc = { event: d.suKien || '*', schema, table: d.bang };
      if (d.loc) loc.filter = d.loc;
      k = k.on('postgres_changes', loc, (payload) => {
        if (cu() || thuBoQuaTin) return;
        tt.tinNhan++;
        d.soTin = (d.soTin || 0) + 1;
        if (!d.gom) { chayAnToan(d, payload); return; }
        // L7: gom tin — nhiều thay đổi liền nhau → 1 lần xử lý
        clearTimeout(d.henGom);
        d.henGom = hen(d.gom, () => chayAnToan(d, payload));
      });
    }
    kenh = k.subscribe((status, err) => {
      if (cu()) return;
      tt.kenh = status;
      if (status === 'SUBSCRIBED') { log('kênh SUBSCRIBED — chờ tin hệ thống "Subscribed to PostgreSQL"'); return; }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (!dung) noiLaiSau(`kênh ${status}${err ? ' · ' + err.message : ''}`);
      }
    });
  }

  function chayAnToan(d, payload) {
    Promise.resolve().then(() => d.xuLy(payload)).catch((e) => log(`xử lý tin ${d.bang} lỗi: ${e.message}`));
  }

  function batBuTatCa(lyDo) {
    for (const d of dangKys) {
      if (!d.batBu) continue;
      Promise.resolve().then(() => d.batBu(lyDo)).catch((e) => log(`bắt bù ${d.bang} lỗi: ${e.message}`));
    }
  }

  async function chayCanary() {
    if (dung) return;
    henCanary = hen(canaryMoiMs, chayCanary);
    if (!tt.sanSang) return;                       // đang nối lại — để lớp L2 lo
    const t0 = Date.now();
    const nhan = new Promise((ok) => { tt.canaryCho = ok; });
    const hetGio = new Promise((ok) => setTimeout(() => ok('het_gio'), CANARY_CHO_MS));
    try {
      const { error } = await sb.from('agent_heartbeat')
        .upsert({ id: idAgent, last_seen: new Date().toISOString(), info: { kenh: tt.kenh, tin: tt.tinNhan } });
      if (error) throw new Error(error.message);
    } catch (e) {
      tt.canaryCho = null;
      log(`canary: ghi lỗi (${e.message}) — không tính là Realtime hỏng`);
      return;
    }
    const kq = await Promise.race([nhan, hetGio]);
    tt.canaryCuoi = Date.now();
    if (kq === 'het_gio') {
      tt.canaryCho = null;
      tt.canaryOk = false;
      tt.canaryHongLienTiep++;
      log(`canary HỎNG lần ${tt.canaryHongLienTiep} (không nhận lại tin trong ${CANARY_CHO_MS / 1000} giây)`);
      if (tt.canaryHongLienTiep >= 2) {
        log('canary hỏng 2 lần liền → huỷ và TẠO LẠI toàn bộ kết nối');
        tt.lanTaoLaiClient++;
        tt.canaryHongLienTiep = 0;
        await taoLaiToanBo();
      }
    } else {
      tt.canaryOk = true;
      tt.canaryHongLienTiep = 0;
      tt.canaryMs = Date.now() - t0;
    }
  }

  async function taoLaiToanBo() {
    theHe++;                                       // mọi báo cáo từ client cũ bị bỏ qua
    try { await sb.removeAllChannels(); } catch { /* bỏ qua */ }
    try { sb.realtime.disconnect(); } catch { /* bỏ qua */ }
    kenh = null;
    taoClient();
    await moKenh();
  }

  return {
    dangKy(d) { dangKys.push(d); },
    async batDau() {
      dung = false;
      taoClient();
      await moKenh();
      henCanary = hen(canaryDauMs, chayCanary);    // canary đầu tiên sau 1 phút, rồi mỗi 10 phút
    },
    async dung() {
      dung = true;
      theHe++;
      clearTimeout(henNoiLai); clearTimeout(henCanary); clearTimeout(henOnDinh);
      try { await sb?.removeAllChannels(); } catch { /* bỏ qua */ }
    },
    // ── móc thử cho bài kiểm tự chữa (KHÔNG dùng trong vận hành) ──
    _thuNgatKetNoi() { sb.realtime.disconnect(); },
    _thuBoQuaTin(v) { thuBoQuaTin = v; },
    trangThai() {
      const now = Date.now();
      let lyDo = '';
      if (tt.kenh !== 'SUBSCRIBED') lyDo = `kênh ${tt.kenh}`;
      else if (!tt.sanSang) lyDo = 'chưa nhận "Subscribed to PostgreSQL"';
      else if (!tt.nhipTimCuoi || now - tt.nhipTimCuoi > NHIP_TIM_QUA_HAN_MS) lyDo = `nhịp tim quá ${NHIP_TIM_QUA_HAN_MS / 1000} giây`;
      else if (tt.canaryOk === false) lyDo = 'canary hỏng';
      return {
        khoe: !lyDo, lyDo, kenh: tt.kenh, sanSang: tt.sanSang, tinNhan: tt.tinNhan, lanNoiLai: tt.lanNoiLai,
        lanTaoLaiClient: tt.lanTaoLaiClient, canaryOk: tt.canaryOk, canaryMs: tt.canaryMs ?? null,
        nhipTimCachS: tt.nhipTimCuoi ? Math.round((now - tt.nhipTimCuoi) / 1000) : null,
        theoBang: Object.fromEntries(dangKys.map((d) => [d.bang, d.soTin || 0])),
      };
    },
  };
}
