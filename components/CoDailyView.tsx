'use client';

// SẢN LƯỢNG CO HÀNG NGÀY (anh Hữu chốt 05/10/2026) — 4 người bộ phận Coating nhập.
// Quét tem LOT xi mạ (mã vạch 10 số) → chỉ thị · mã hàng · kg tự hiện (catalog ERP agent đẩy lên)
// → chọn máy, sửa kg nếu cần, chọn nhân viên, ghi chú → Thêm. Cuối ngày bấm "Gửi phiếu" → app chính lưu vĩnh viễn.
// stage (06/10/2026): '86' Sản lượng CO (máy CO-01..03) · '84' Sản lượng AB công đoạn 84 (máy AB-01) — cùng 1 màn.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BarcodeScanButton from './BarcodeScanButton';
import DateButton from './DateButton';
import PrintJobButton from './PrintJobButton';
import { toTitleCase } from '@/lib/format';
import { CO_STAGES, NO_LOT_MSG, decodeCoLots, normalizeLot, type CoLine, type CoLot, type CoSlip, type CoStage } from '@/lib/co-day';

type Emp = { id: string; full_name: string; order_no: number };

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtKg = (v: number | null | undefined) =>
  v == null ? '' : Number(v).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Draft = {
  editId: string | null;
  lotText: string;
  lot: CoLot | null;
  manual: boolean;          // LOT không có trong catalog → gõ tay chỉ thị + mã hàng
  saeji: string;
  item: string;
  machine: string;
  kg: string;
  employeeId: string;
  note: string;
};
const emptyDraft = (machine = '', employeeId = ''): Draft => ({
  editId: null, lotText: '', lot: null, manual: false, saeji: '', item: '', machine, kg: '', employeeId, note: '',
});

const STATUS: Record<CoSlip['status'], { t: string; c: string }> = {
  draft: { t: '📝 Đang ghi — chưa gửi app chính', c: 'bg-amber-50 border-amber-300 text-amber-800' },
  pending: { t: '📤 Đã bấm Gửi — đang chờ đẩy sang app chính', c: 'bg-sky-50 border-sky-300 text-sky-800' },
  received: { t: '✅ App chính đã nhận', c: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
};

// canSend (06/10/2026): chỉ tổ trưởng thấy nút Gửi phiếu cuối ngày và nút Xoá phiếu ngày; 07/10: Xoá từng dòng cũng chỉ tổ trưởng — tổ viên quét nhập + Sửa
export default function CoDailyView({ currentUserFullName, stage = '86', canSend = false }: {
  currentUserFullName?: string | null; stage?: CoStage; canSend?: boolean;
}) {
  const cfg = CO_STAGES[stage];
  // Chỉ 1 máy (AB-01) → chọn sẵn (anh Hữu 06/10/2026)
  const defMachine = cfg.machines.length === 1 ? cfg.machines[0] : '';
  const [date, setDate] = useState(todayISO());
  const [slip, setSlip] = useState<CoSlip | null>(null);
  const [lines, setLines] = useState<CoLine[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [catalog, setCatalog] = useState<Map<string, CoLot> | null>(null);
  const [catAt, setCatAt] = useState<string | null>(null);
  const [catErr, setCatErr] = useState('');
  const [d, setD] = useState<Draft>(emptyDraft(defMachine));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async (dt: string) => {
    const r = await fetch(`/api/co-days?date=${dt}&stage=${stage}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || 'Không tải được phiếu'); return; }
    setErr('');
    setSlip(j.slip); setLines(j.lines ?? []); setEmps(j.employees ?? []);
  }, [stage]);

  // Tải phiếu khi đổi ngày — setState nằm sau await fetch (không đồng bộ), cùng mẫu các card khác của app
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(date); }, [date, load]);

  // Đã bấm Gửi → tự hỏi lại mỗi 10 giây tới khi app chính nhận (anh Hữu 05/10: trước phải tải lại trang mới thấy ✅)
  useEffect(() => {
    if (slip?.status !== 'pending') return;
    const t = setInterval(() => { void load(date); }, 10_000);
    return () => clearInterval(t);
  }, [slip?.status, date, load]);

  // Catalog LOT xi mạ: CHỈ tải khi bấm Quét / bắt đầu gõ LOT (anh Hữu 05/10/2026: tiết kiệm gói Free),
  // 1 lần mỗi lần mở app. File gọn ≈ 110 KB (15 mã Coating, 12 tháng).
  // 07/10/2026: quét/gõ trong lúc ĐANG tải thì CHỜ cùng lần tải đó (trước trả rỗng → LOT có trên ERP bị coi là gõ tay,
  // vụ 3 dòng CO 06/10). fresh = tải lại bỏ cache khi không thấy LOT (agent đẩy catalog mỗi 10'), tối đa 1 lần/phút.
  const [catLoading, setCatLoading] = useState(false);
  const catRef = useRef<Map<string, CoLot> | null>(null);
  const catPending = useRef<Promise<Map<string, CoLot> | null> | null>(null);
  const lastFresh = useRef(0);
  const ensureCatalog = useCallback(async (fresh = false): Promise<Map<string, CoLot> | null> => {
    if (catRef.current && !fresh) return catRef.current;
    if (catPending.current) return catPending.current;
    if (fresh) {
      if (Date.now() - lastFresh.current < 60_000) return catRef.current;
      lastFresh.current = Date.now();
    }
    setCatLoading(true);
    catPending.current = (async () => {
      try {
        const r = await fetch(`/api/co-lots?stage=${stage}${fresh ? `&t=${Date.now()}` : ''}`, fresh ? { cache: 'no-store' } : undefined);
        const j = await r.json();
        const m = decodeCoLots(j);
        catRef.current = m;
        setCatalog(m); setCatAt(j.generated_at ?? null);
        setCatErr(j.error ? String(j.error) : '');
        return m;
      } catch {
        setCatErr('Không tải được danh sách LOT'); return catRef.current;
      } finally { setCatLoading(false); catPending.current = null; }
    })();
    return catPending.current;
  }, [stage]);

  // Mặc định nhân viên = chính người đăng nhập (nếu là 1 trong 4 người CO)
  const myEmpId = useMemo(() => {
    const me = (currentUserFullName ?? '').trim().toUpperCase();
    return emps.find((e) => e.full_name.trim().toUpperCase() === me)?.id ?? '';
  }, [emps, currentUserFullName]);
  // Nhân viên đang chọn: chọn tay > mặc định là chính người đăng nhập
  const empSel = d.employeeId || myEmpId;

  // Ô LOT đổi / quét xong → hiện chữ ngay, rồi CHỜ catalog mới tra; chỉ áp kết quả nếu ô vẫn là chuỗi đó.
  // keepKg: mở Sửa dòng cũ thì giữ kg đã nhập, không thay bằng kg LOT ERP.
  const lotTextRef = useRef('');
  const [lotChecking, setLotChecking] = useState(false);
  async function applyLot(text: string, keepKg = false) {
    lotTextRef.current = text;
    const key = normalizeLot(text);
    setD((x) => {
      const same = x.lot?.lot === key;
      // CO: bỏ LOT cũ thì bỏ luôn kg của LOT đó (đang Sửa dòng thì giữ kg đã nhập)
      const dropKg = cfg.requireLot && !same && !!x.lot && !x.editId && !keepKg;
      return { ...x, lotText: text, lot: same ? x.lot : null, ...(dropKg ? { kg: '' } : {}), ...(key.length < 6 ? { manual: false } : {}) };
    });
    if (key.length < 6) { setLotChecking(false); return; }
    setLotChecking(true);
    let m = await ensureCatalog();
    let lot = m?.get(key) ?? null;
    if (!lot && key.length >= 10) { m = await ensureCatalog(true); lot = m?.get(key) ?? null; }
    if (lotTextRef.current !== text) return;           // đã gõ/quét chuỗi khác trong lúc chờ
    setLotChecking(false);
    setD((x) => ({
      ...x, lotText: text, lot,
      manual: !cfg.requireLot && !lot,
      saeji: lot ? lot.saeji : x.manual ? x.saeji : '',
      item: lot ? lot.item : x.manual ? x.item : '',
      kg: lot && !keepKg ? String(lot.kg) : x.kg,
    }));
  }
  // CO: chưa có LOT xi mạ hợp lệ thì khoá các ô còn lại (anh Hữu 07/10/2026)
  const lotKey = normalizeLot(d.lotText);
  const locked = cfg.requireLot && !d.lot;
  const noLot = cfg.requireLot && !d.lot && !lotChecking && !catLoading && catalog !== null && lotKey.length >= 10;

  const dupLine = useMemo(() => {
    const key = normalizeLot(d.lotText);
    return key ? lines.find((l) => l.lot_no === key && l.id !== d.editId) : undefined;
  }, [d.lotText, d.editId, lines]);

  async function save() {
    setErr(''); setMsg('');
    const key = normalizeLot(d.lotText);
    if (key.length < 6) return setErr('Chưa quét / nhập LOT NO');
    if (cfg.requireLot && !d.lot) return setErr(lotChecking || catLoading ? 'Đang tìm LOT — chờ một chút' : `${NO_LOT_MSG} — quét tem LOT xi mạ`);
    if (!d.machine) return setErr('Chưa chọn máy');
    const kg = Number(String(d.kg).replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0) return setErr('Trọng lượng phải lớn hơn 0');
    if (!empSel) return setErr('Chưa chọn nhân viên');
    if (d.manual && !d.item.trim()) return setErr('LOT không có trong ERP — nhập tay mã hàng');
    const line = {
      machine: d.machine, lot_no: key,
      lot_label: d.lot?.label ?? null, vendor: d.lot?.vendor ?? null,
      saeji: d.lot ? d.lot.saeji : d.saeji.trim() || null,
      item_code: d.lot ? d.lot.item : d.item.trim(), item_name: d.lot?.name ?? null,
      lot_weight_kg: d.lot?.kg ?? null, weight_kg: kg, lot_qty: d.lot?.qty ?? null,
      employee_id: empSel, note: d.note, matched: !!d.lot,
    };
    setBusy(true);
    try {
      const r = d.editId
        ? await fetch(`/api/co-days/lines/${d.editId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ line }) })
        : await fetch('/api/co-days', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date, stage, line }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(j.error || 'Không lưu được');
      setMsg(d.editId ? 'Đã sửa dòng' : `Đã thêm LOT ${d.lot?.label ?? key}`);
      setD(emptyDraft(d.machine, empSel));     // giữ máy + nhân viên cho LOT kế tiếp
      await load(date);
    } finally { setBusy(false); }
  }

  async function remove(l: CoLine) {
    if (!confirm(`Xoá dòng LOT ${l.lot_label ?? l.lot_no}?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/co-days/lines/${l.id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error || 'Không xoá được');
      await load(date);
    } finally { setBusy(false); }
  }

  function edit(l: CoLine) {
    const lot = catalog?.get(l.lot_no) ?? null;
    const text = l.lot_label ?? l.lot_no;
    setD({
      editId: l.id, lotText: text, lot, manual: !cfg.requireLot && !lot,
      saeji: l.saeji ?? '', item: l.item_code ?? '', machine: l.machine, kg: String(l.weight_kg),
      employeeId: l.employee_id ?? '', note: l.note ?? '',
    });
    // Catalog chưa tải → tải rồi tra lại (dòng cũ gõ tay 06/10 mà LOT có trong danh sách thì tự khớp khi Lưu sửa)
    if (!lot) void applyLot(text, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function send() {
    if (!confirm(`Gửi phiếu ${cfg.title} ngày ${date.split('-').reverse().join('/')} (${lines.length} dòng) sang app chính?`)) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/co-days/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date, stage }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(j.error || 'Không gửi được');
      setMsg(`Đã gửi ${j.n_lines} dòng — app chính nhận trong khoảng 1 phút`);
      await load(date);
    } finally { setBusy(false); }
  }

  async function deleteSlip() {
    const dd = date.split('-').reverse().join('/');
    const onMain = slip?.status !== 'draft' || !!slip?.received_at;
    const extra = onMain ? ' Phiếu đã ở app chính — app chính sẽ xoá theo trong khoảng 1 phút.' : '';
    if (!confirm(`Xoá CẢ phiếu ${cfg.title} ngày ${dd} (${lines.length} dòng)?${extra}`)) return;
    if (!confirm('Xác nhận lần 2: xoá hẳn, không khôi phục được?')) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch(`/api/co-days?date=${date}&stage=${stage}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(j.error || 'Không xoá được');
      setMsg(j.main_delete_queued ? `Đã xoá phiếu ngày ${dd} — app chính xoá theo trong khoảng 1 phút` : `Đã xoá phiếu ngày ${dd}`);
      setSlip(null); setLines([]);
    } finally { setBusy(false); }
  }

  const total = lines.reduce((s, l) => s + Number(l.weight_kg || 0), 0);
  const saejiDisp = (s: string | null) => (s && s.length >= 6 ? `${s.slice(-6, -3)}-${s.slice(-3)}` : s ?? '');
  const inp = 'w-full px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-brand-navy">{stage === '84' ? '🔩' : '🎨'} {cfg.title} hàng ngày</div>
          <DateButton value={date} onChange={(v) => { setDate(v); setD(emptyDraft(d.machine, d.employeeId)); }} />
        </div>
        {slip && (
          <div className={`text-xs border rounded-md px-3 py-2 ${STATUS[slip.status].c}`}>
            {STATUS[slip.status].t}
            {slip.sent_at && ` · gửi ${new Date(slip.sent_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} bởi ${toTitleCase(slip.sent_by_name ?? '')}`}
            {slip.last_error && <div className="text-red-700 font-semibold mt-1">⚠ Lỗi đẩy: {slip.last_error}</div>}
          </div>
        )}

        {/* ── Nhập 1 dòng ── */}
        <div className="space-y-2.5 border-t border-brand-surface-alt pt-3">
          <div className="text-xs font-semibold text-brand-navy">{d.editId ? '✏️ Sửa dòng' : '➕ Thêm LOT'}</div>
          <div className="flex gap-2">
            <input value={d.lotText} onFocus={() => { void ensureCatalog(); }}
              onChange={(e) => { void applyLot(e.target.value); }} inputMode="numeric"
              placeholder="LOT NO xi mạ (quét hoặc gõ 10 số)" className={`${inp} ${noLot ? 'border-red-500 ring-2 ring-red-300' : ''}`} />
            <BarcodeScanButton label="📷 Quét" onScan={(t) => { void applyLot(t); }} />
          </div>
          {catErr && (
            <div className="text-[11px] text-amber-700">
              ⚠ {catErr} — {cfg.requireLot ? 'chưa nhập được, ' : 'vẫn gõ tay được, '}
              <button type="button" className="underline font-semibold" onClick={() => { lastFresh.current = 0; void ensureCatalog(true); }}>Tải lại</button>
            </div>
          )}
          {(catLoading || lotChecking) && <div className="text-[11px] text-brand-navy-soft">Đang tải danh sách LOT xi mạ…</div>}
          {noLot && (
            <div className="text-sm font-bold text-red-700 bg-red-50 border border-red-300 rounded-md px-3 py-2">
              ❌ {NO_LOT_MSG} ({lotKey}) — không có trong danh sách LOT xi mạ {cfg.itemsLabel}, 12 tháng. Kiểm tra lại tem rồi quét lại.
            </div>
          )}
          {cfg.requireLot && !d.lot && !noLot && <div className="text-[11px] text-brand-navy-soft">Quét được LOT xi mạ thì mới nhập máy, trọng lượng, nhân viên.</div>}
          {!catErr && catalog && <div className="text-[11px] text-brand-navy-soft">Danh sách LOT xi mạ ({cfg.itemsLabel}, 12 tháng): {catalog.size.toLocaleString('vi-VN')} lot{catAt ? ` · cập nhật ${new Date(catAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : ''}</div>}
          {d.lot && (
            <div className="text-xs bg-brand-teal/10 border border-brand-teal/40 rounded-md px-3 py-2 text-brand-navy space-y-0.5">
              <div><b>{d.lot.label}</b> · nhập {d.lot.date.split('-').reverse().join('/')}</div>
              <div>Chỉ thị <b>{d.lot.saeji_disp}</b> · Mã hàng <b>{d.lot.item}</b></div>
              <div className="text-brand-navy-soft">{d.lot.name} {d.lot.spec} · {d.lot.qty.toLocaleString('vi-VN')} EA · {fmtKg(d.lot.kg)} Kg</div>
            </div>
          )}
          {d.manual && (
            <div className="space-y-2">
              <div className="text-[11px] text-amber-700">⚠ LOT không có trong danh sách xi mạ ({cfg.itemsLabel}, 12 tháng) — nhập tay chỉ thị và mã hàng</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={d.saeji} onChange={(e) => setD({ ...d, saeji: e.target.value })} placeholder="Chỉ thị thư" className={inp} />
                <input value={d.item} onChange={(e) => setD({ ...d, item: e.target.value })} placeholder="Mã hàng" className={inp} />
              </div>
            </div>
          )}
          {dupLine && <div className="text-[11px] text-red-600 font-semibold">⚠ LOT này đã có ở dòng {dupLine.seq_no} ({dupLine.machine}) hôm nay</div>}
          <fieldset disabled={locked} className={`space-y-2.5 min-w-0 ${locked ? 'opacity-40' : ''}`}>
          <div className={`grid ${cfg.machines.length === 1 ? 'grid-cols-1' : 'grid-cols-3'} gap-2`}>
            {cfg.machines.map((m) => (
              <button key={m} type="button" onClick={() => setD({ ...d, machine: m })}
                className={`py-2 rounded-md border text-sm font-bold ${d.machine === m ? 'bg-[#ea580c] text-white border-[#ea580c]' : 'bg-white text-brand-navy border-gray-300'}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-brand-navy">Trọng lượng (Kg)
              {/* Viền vàng + số đậm cho dễ nhận biết (anh Hữu 06/10/2026) */}
              <input value={d.kg} onChange={(e) => setD({ ...d, kg: e.target.value })} inputMode="decimal"
                className="w-full h-12 px-3 border-2 border-amber-400 rounded-md text-brand-navy font-bold text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
              {d.lot && Number(String(d.kg).replace(',', '.')) !== d.lot.kg && <span className="text-[10px] text-amber-700">LOT ERP: {fmtKg(d.lot.kg)} Kg</span>}
            </label>
            <label className="text-xs text-brand-navy">Nhân viên
              {/* Tên đậm, chữ to 1 bậc; cao bằng ô trọng lượng — Safari iOS bỏ qua padding của select nên đặt chiều cao cố định */}
              <select value={empSel} onChange={(e) => setD({ ...d, employeeId: e.target.value })} className={`${inp} h-12 font-bold text-base`}>
                <option value="">— Chọn —</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{toTitleCase(e.full_name)}</option>)}
              </select>
            </label>
          </div>
          <input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="Ghi chú" className={inp} />
          </fieldset>
          {err && <div className="text-sm text-red-600">{err}</div>}
          {msg && <div className="text-sm text-emerald-700">{msg}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy || locked}
              className="flex-1 py-2.5 rounded-xl bg-brand-teal text-white font-semibold disabled:opacity-50">
              {d.editId ? 'Lưu sửa' : 'Thêm dòng'}
            </button>
            {d.editId && (
              <button type="button" onClick={() => setD(emptyDraft(d.machine, d.employeeId))}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-brand-navy">Huỷ</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Danh sách dòng trong ngày ── */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-surface-alt">
          <div className="text-sm font-bold text-brand-navy">Kết quả ngày {date.split('-').reverse().join('/')}</div>
          <div className="text-xs text-brand-navy-soft">{lines.length} LOT · <b className="text-brand-navy">{fmtKg(total)} Kg</b></div>
        </div>
        {lines.length === 0 ? (
          <p className="p-5 text-sm text-brand-navy-soft text-center">Chưa có dòng nào.</p>
        ) : (
          <div className="divide-y divide-brand-surface-alt">
            {lines.map((l) => (
              <div key={l.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-brand-navy">{l.seq_no}. {l.machine} · {l.item_code}</div>
                  <div className="font-bold text-[#ea580c] whitespace-nowrap">{fmtKg(l.weight_kg)} Kg</div>
                </div>
                <div className="text-xs text-brand-navy-soft">
                  LOT {l.lot_label ?? l.lot_no}{!l.matched && ' (gõ tay)'} · Chỉ thị {saejiDisp(l.saeji)} · {toTitleCase(l.employee_name ?? '')}
                  {l.lot_weight_kg != null && Number(l.lot_weight_kg) !== Number(l.weight_kg) && ` · LOT ERP ${fmtKg(l.lot_weight_kg)} Kg`}
                </div>
                {l.note && <div className="text-xs text-brand-navy">📝 {l.note}</div>}
                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={() => edit(l)} className="text-xs text-brand-teal font-semibold">Sửa</button>
                  {/* Xoá dòng: chỉ tổ trưởng (+ admin) — tổ viên chỉ Sửa (anh Hữu 07/10/2026) */}
                  {canSend && <button type="button" onClick={() => remove(l)} className="text-xs text-red-600 font-semibold">Xoá</button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {lines.length > 0 && (
          <div className="p-4 border-t border-brand-surface-alt space-y-2">
            {canSend ? (
              <button type="button" onClick={send} disabled={busy || slip?.status === 'pending'}
                className="w-full py-3 rounded-xl bg-[#ea580c] text-white font-bold disabled:opacity-50">
                {slip?.status === 'received' ? '✅ Đã gửi app chính — bấm để gửi lại' : slip?.status === 'pending' ? '📤 Đang đẩy sang app chính (khoảng 1 phút)…' : '📤 Gửi phiếu cuối ngày'}
              </button>
            ) : (
              <p className="text-xs text-brand-navy-soft text-center">Tổ trưởng kiểm tra và gửi phiếu cuối ngày.</p>
            )}
            <PrintJobButton type="co_day" refId={stage === '84' ? `${date}|84` : date} label="🖨 In bảng kết quả" />
            {slip && canSend && (
              <button type="button" onClick={deleteSlip} disabled={busy}
                className="w-full py-2 rounded-xl border border-red-300 text-red-700 text-sm font-semibold disabled:opacity-50">
                🗑 Xoá phiếu ngày
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
