'use client';

// SẢN LƯỢNG CO HÀNG NGÀY (anh Hữu chốt 05/10/2026) — 4 người bộ phận Coating nhập.
// Quét tem LOT xi mạ (mã vạch 10 số) → chỉ thị · mã hàng · kg tự hiện (catalog ERP agent đẩy lên)
// → chọn máy, sửa kg nếu cần, chọn nhân viên, ghi chú → Thêm. Cuối ngày bấm "Gửi phiếu" → app chính lưu vĩnh viễn.
import { useCallback, useEffect, useMemo, useState } from 'react';
import BarcodeScanButton from './BarcodeScanButton';
import DateButton from './DateButton';
import PrintJobButton from './PrintJobButton';
import { toTitleCase } from '@/lib/format';
import { CO_MACHINES, normalizeLot, type CoLine, type CoLot, type CoSlip } from '@/lib/co-day';

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

export default function CoDailyView({ currentUserFullName }: { currentUserFullName?: string | null }) {
  const [date, setDate] = useState(todayISO());
  const [slip, setSlip] = useState<CoSlip | null>(null);
  const [lines, setLines] = useState<CoLine[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [catalog, setCatalog] = useState<Map<string, CoLot> | null>(null);
  const [catAt, setCatAt] = useState<string | null>(null);
  const [catErr, setCatErr] = useState('');
  const [d, setD] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async (dt: string) => {
    const r = await fetch(`/api/co-days?date=${dt}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || 'Không tải được phiếu'); return; }
    setErr('');
    setSlip(j.slip); setLines(j.lines ?? []); setEmps(j.employees ?? []);
  }, []);

  // Tải phiếu khi đổi ngày — setState nằm sau await fetch (không đồng bộ), cùng mẫu các card khác của app
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(date); }, [date, load]);

  // Đã bấm Gửi → tự hỏi lại mỗi 10 giây tới khi app chính nhận (anh Hữu 05/10: trước phải tải lại trang mới thấy ✅)
  useEffect(() => {
    if (slip?.status !== 'pending') return;
    const t = setInterval(() => { void load(date); }, 10_000);
    return () => clearInterval(t);
  }, [slip?.status, date, load]);

  // Catalog LOT tải 1 lần (≈4.500 lot)
  useEffect(() => {
    let cancel = false;
    fetch('/api/co-lots').then((r) => r.json()).then((j) => {
      if (cancel) return;
      const m = new Map<string, CoLot>();
      for (const l of (j.lots ?? []) as CoLot[]) m.set(l.lot, l);
      setCatalog(m); setCatAt(j.generated_at ?? null);
      if (j.error) setCatErr(j.error);
    }).catch(() => !cancel && setCatErr('Không tải được danh sách LOT'));
    return () => { cancel = true; };
  }, []);

  // Mặc định nhân viên = chính người đăng nhập (nếu là 1 trong 4 người CO)
  const myEmpId = useMemo(() => {
    const me = (currentUserFullName ?? '').trim().toUpperCase();
    return emps.find((e) => e.full_name.trim().toUpperCase() === me)?.id ?? '';
  }, [emps, currentUserFullName]);
  // Nhân viên đang chọn: chọn tay > mặc định là chính người đăng nhập
  const empSel = d.employeeId || myEmpId;

  function applyLot(text: string) {
    const key = normalizeLot(text);
    const lot = catalog?.get(key) ?? null;
    setD((x) => ({
      ...x, lotText: text, lot,
      manual: !lot && key.length >= 6,
      saeji: lot ? lot.saeji : x.manual ? x.saeji : '',
      item: lot ? lot.item : x.manual ? x.item : '',
      kg: lot ? String(lot.kg) : x.kg,
    }));
  }

  const dupLine = useMemo(() => {
    const key = normalizeLot(d.lotText);
    return key ? lines.find((l) => l.lot_no === key && l.id !== d.editId) : undefined;
  }, [d.lotText, d.editId, lines]);

  async function save() {
    setErr(''); setMsg('');
    const key = normalizeLot(d.lotText);
    if (key.length < 6) return setErr('Chưa quét / nhập LOT NO');
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
        : await fetch('/api/co-days', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date, line }) });
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
    setD({
      editId: l.id, lotText: l.lot_label ?? l.lot_no, lot, manual: !lot,
      saeji: l.saeji ?? '', item: l.item_code ?? '', machine: l.machine, kg: String(l.weight_kg),
      employeeId: l.employee_id ?? '', note: l.note ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function send() {
    if (!confirm(`Gửi phiếu Sản lượng CO ngày ${date.split('-').reverse().join('/')} (${lines.length} dòng) sang app chính?`)) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/co-days/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(j.error || 'Không gửi được');
      setMsg(`Đã gửi ${j.n_lines} dòng — app chính nhận trong khoảng 1 phút`);
      await load(date);
    } finally { setBusy(false); }
  }

  const total = lines.reduce((s, l) => s + Number(l.weight_kg || 0), 0);
  const saejiDisp = (s: string | null) => (s && s.length >= 6 ? `${s.slice(-6, -3)}-${s.slice(-3)}` : s ?? '');
  const inp = 'w-full px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-brand-navy">🎨 Sản lượng CO hàng ngày</div>
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
            <input value={d.lotText} onChange={(e) => applyLot(e.target.value)} inputMode="numeric"
              placeholder="LOT NO xi mạ (quét hoặc gõ 10 số)" className={inp} />
            <BarcodeScanButton label="📷 Quét" onScan={(t) => applyLot(t)} />
          </div>
          {catErr && <div className="text-[11px] text-amber-700">⚠ {catErr} — vẫn gõ tay được</div>}
          {!catErr && catalog && <div className="text-[11px] text-brand-navy-soft">Danh sách LOT xi mạ: {catalog.size.toLocaleString('vi-VN')} lot{catAt ? ` · cập nhật ${new Date(catAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : ''}</div>}
          {d.lot && (
            <div className="text-xs bg-brand-teal/10 border border-brand-teal/40 rounded-md px-3 py-2 text-brand-navy space-y-0.5">
              <div><b>{d.lot.label}</b> · nhập {d.lot.date.split('-').reverse().join('/')}</div>
              <div>Chỉ thị <b>{d.lot.saeji_disp}</b> · Mã hàng <b>{d.lot.item}</b></div>
              <div className="text-brand-navy-soft">{d.lot.name} {d.lot.spec} · {d.lot.qty.toLocaleString('vi-VN')} EA · {fmtKg(d.lot.kg)} Kg</div>
            </div>
          )}
          {d.manual && (
            <div className="space-y-2">
              <div className="text-[11px] text-amber-700">⚠ LOT không có trong danh sách xi mạ ERP 120 ngày — nhập tay chỉ thị và mã hàng</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={d.saeji} onChange={(e) => setD({ ...d, saeji: e.target.value })} placeholder="Chỉ thị thư" className={inp} />
                <input value={d.item} onChange={(e) => setD({ ...d, item: e.target.value })} placeholder="Mã hàng" className={inp} />
              </div>
            </div>
          )}
          {dupLine && <div className="text-[11px] text-red-600 font-semibold">⚠ LOT này đã có ở dòng {dupLine.seq_no} ({dupLine.machine}) hôm nay</div>}
          <div className="grid grid-cols-3 gap-2">
            {CO_MACHINES.map((m) => (
              <button key={m} type="button" onClick={() => setD({ ...d, machine: m })}
                className={`py-2 rounded-md border text-sm font-bold ${d.machine === m ? 'bg-[#ea580c] text-white border-[#ea580c]' : 'bg-white text-brand-navy border-gray-300'}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-brand-navy">Trọng lượng (Kg)
              <input value={d.kg} onChange={(e) => setD({ ...d, kg: e.target.value })} inputMode="decimal" className={inp} />
              {d.lot && Number(String(d.kg).replace(',', '.')) !== d.lot.kg && <span className="text-[10px] text-amber-700">LOT ERP: {fmtKg(d.lot.kg)} Kg</span>}
            </label>
            <label className="text-xs text-brand-navy">Nhân viên
              <select value={empSel} onChange={(e) => setD({ ...d, employeeId: e.target.value })} className={inp}>
                <option value="">— Chọn —</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{toTitleCase(e.full_name)}</option>)}
              </select>
            </label>
          </div>
          <input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="Ghi chú" className={inp} />
          {err && <div className="text-sm text-red-600">{err}</div>}
          {msg && <div className="text-sm text-emerald-700">{msg}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy}
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
                  <button type="button" onClick={() => remove(l)} className="text-xs text-red-600 font-semibold">Xoá</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {lines.length > 0 && (
          <div className="p-4 border-t border-brand-surface-alt space-y-2">
            <button type="button" onClick={send} disabled={busy || slip?.status === 'pending'}
              className="w-full py-3 rounded-xl bg-[#ea580c] text-white font-bold disabled:opacity-50">
              {slip?.status === 'received' ? '✅ Đã gửi app chính — bấm để gửi lại' : slip?.status === 'pending' ? '📤 Đang đẩy sang app chính (khoảng 1 phút)…' : '📤 Gửi phiếu cuối ngày'}
            </button>
            <PrintJobButton type="co_day" refId={date} label="🖨 In bảng kết quả" />
          </div>
        )}
      </div>
    </div>
  );
}
