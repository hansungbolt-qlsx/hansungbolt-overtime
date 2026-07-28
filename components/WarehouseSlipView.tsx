'use client';

// XUẤT / TRẢ KHO NGUYÊN PHỤ LIỆU trên điện thoại (28/07/2026).
//
// Nguyên tắc nền: app chính là CHỦ KHO DUY NHẤT. Màn này chỉ GHI YÊU CẦU —
// bấm Gửi thì agent đẩy sang app chính, người duyệt bấm Duyệt thì tồn mới đổi.
// Spec đầy đủ: hsb-material-app/docs/SPEC_OT_XUAT_TRA_KHO.md
//
// 1 component dùng cho CẢ Xuất kho lẫn Trả kho (khác nhau ở `kind`), mỗi cái có
// 2 nhánh Nguyên liệu / Phụ liệu — đúng cấu trúc user chốt.

import { useCallback, useEffect, useMemo, useState } from 'react';
import BarcodeScanButton from './BarcodeScanButton';
import {
  BRANCH_LABEL, DEPARTMENTS, KIND_LABEL, defaultDepartment,
  type Branch, type Department, type Kind, type SlipLine,
  type StockAux, type StockCoil,
} from '@/lib/nvl-slips';

type MasterNvl = { id: number; code: string; name: string; size: string; unit: string };

type Slip = {
  id: string; uid: string; slip_date: string; seq: number; status: string;
  note: string | null; reject_reason: string | null;
  approved_at: string | null; approved_by: string | null;
  main_refs: Array<{ no: string; department: string }>;
  line_errors: Array<{ seq: number; code?: string; error: string }>;
  created_by_name: string | null;
};

type SlipEvent = { at: string; actor: string | null; action: string; detail: Record<string, unknown> };

const fmtQty = (n: number) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: 3 });

function hhmmVN() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);
}

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  draft: { label: '📝 Đang ghi (chưa gửi)', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  pending: { label: '📤 Đã gửi — chờ duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  approved: { label: '✅ Đã duyệt — tồn đã trừ', cls: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  rejected: { label: '❌ Bị từ chối', cls: 'bg-rose-50 text-rose-800 border-rose-300' },
};

export default function WarehouseSlipView({ kind }: { kind: Kind }) {
  const [branch, setBranch] = useState<Branch>('nvl');
  const [loadedFor, setLoadedFor] = useState('');
  const loading = loadedFor !== `${kind}|${branch}`;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [slip, setSlip] = useState<Slip | null>(null);
  const [lines, setLines] = useState<SlipLine[]>([]);
  const [events, setEvents] = useState<SlipEvent[]>([]);
  const [slipNote, setSlipNote] = useState('');

  // Tồn app chính đẩy xuống
  const [coils, setCoils] = useState<StockCoil[]>([]);
  const [auxMats, setAuxMats] = useState<StockAux[]>([]);
  const [nvlMaster, setNvlMaster] = useState<MasterNvl[]>([]);
  const [stockAt, setStockAt] = useState<string>('');

  // Form thêm dòng
  const [q, setQ] = useState('');
  const [pickedCode, setPickedCode] = useState('');
  const [dept, setDept] = useState<Department>('Heading');
  const [lineNote, setLineNote] = useState('');
  const [auxQty, setAuxQty] = useState('');
  const [ticked, setTicked] = useState<Record<number, string>>({});   // coil_id → Kg (chuỗi)

  const isNvl = branch === 'nvl';
  const isReturn = kind === 'return';
  // TRẢ kho nguyên liệu tick từ cuộn ĐANG Ở LINE; XUẤT kho tick từ cuộn kho Main
  const stockPart = isReturn ? 'nvl_line' : 'nvl_main';

  const resetForm = useCallback(() => {
    setQ(''); setPickedCode(''); setLineNote(''); setAuxQty(''); setTicked({});
  }, []);

  const loadSlip = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch(`/api/nvl-slips?kind=${kind}&branch=${branch}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Không tải được phiếu');
      setSlip(d.slip);
      setSlipNote(d.slip?.note ?? '');
      setLines(
        (d.lines ?? []).map((l: SlipLine & { qty: string | number }) => ({
          ...l, qty: Number(l.qty),
        })),
      );
      setEvents(d.events ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải phiếu');
    }
  }, [kind, branch]);

  const loadStock = useCallback(async () => {
    try {
      const parts = isNvl ? `${stockPart},nvl_master` : 'aux';
      const r = await fetch(`/api/nvl-stock?part=${parts}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Không tải được tồn kho');
      if (isNvl) {
        setCoils((d.parts?.[stockPart]?.payload ?? []) as StockCoil[]);
        setNvlMaster((d.parts?.nvl_master?.payload ?? []) as MasterNvl[]);
        setStockAt(d.parts?.[stockPart]?.pushed_at ?? '');
      } else {
        setAuxMats((d.parts?.aux?.payload ?? []) as StockAux[]);
        setStockAt(d.parts?.aux?.pushed_at ?? '');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải tồn kho');
    }
  }, [isNvl, stockPart]);

  // Không setState đồng bộ trong effect (cascading render) — `loading` suy ra từ
  // "đã nạp xong cho tổ hợp nào", chỉ set sau khi await xong.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadSlip(), loadStock()]);
      if (!cancelled) setLoadedFor(`${kind}|${branch}`);
    })();
    return () => { cancelled = true; };
  }, [kind, branch, loadSlip, loadStock]);

  // ---- Ô gợi ý mã -------------------------------------------------------
  // NVL: gộp cuộn theo mã để hiện "Code – Tên – Size – n cuộn / x kg"
  const nvlOptions = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; size: string; n: number; kg: number }>();
    for (const c of coils) {
      const cur = byCode.get(c.code) ?? { code: c.code, name: c.name, size: c.size, n: 0, kg: 0 };
      cur.n += 1; cur.kg += c.kg;
      byCode.set(c.code, cur);
    }
    // Mã trong master mà không còn cuộn nào → vẫn hiện, tồn 0 (để báo hết tồn)
    for (const m of nvlMaster) {
      if (!byCode.has(m.code)) {
        byCode.set(m.code, { code: m.code, name: m.name, size: m.size, n: 0, kg: 0 });
      }
    }
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [coils, nvlMaster]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    if (isNvl) {
      return nvlOptions
        .filter((o) => `${o.code} ${o.name} ${o.size}`.toLowerCase().includes(s))
        .slice(0, 20);
    }
    return auxMats
      .filter((m) => `${m.code} ${m.name} ${m.material} ${m.spec}`.toLowerCase().includes(s))
      .slice(0, 20);
  }, [q, isNvl, nvlOptions, auxMats]);

  const pickedNvl = useMemo(
    () => nvlOptions.find((o) => o.code === pickedCode) ?? null,
    [nvlOptions, pickedCode],
  );
  const pickedAux = useMemo(
    () => auxMats.find((m) => m.code === pickedCode) ?? null,
    [auxMats, pickedCode],
  );

  // Cuộn của mã đang chọn, trừ cuộn đã nằm trong phiếu
  const usedCoilIds = useMemo(
    () => new Set(lines.map((l) => l.coil_id).filter(Boolean) as number[]),
    [lines],
  );
  const coilsOfPicked = useMemo(
    () => coils.filter((c) => c.code === pickedCode && !usedCoilIds.has(c.id)),
    [coils, pickedCode, usedCoilIds],
  );

  function pick(code: string, name = '') {
    setPickedCode(code);
    setQ(code);
    setTicked({});
    setAuxQty('');
    setDept(defaultDepartment(branch, code, name));
  }

  // Quét tem → tìm cuộn theo Lot No (hoặc số cuộn) rồi tự tick
  const onScan = useCallback(
    (text: string) => {
      const s = text.trim().toUpperCase();
      const hit = coils.filter(
        (c) =>
          !usedCoilIds.has(c.id) &&
          ((c.lot_no || '').toUpperCase() === s || (c.coil_no || '').toUpperCase() === s),
      );
      if (hit.length === 0) {
        setErr(`Lot "${text}" không có trong tồn`);
        return;
      }
      setErr('');
      // Nhảy sang mã của cuộn quét được rồi tick
      const code = hit[0].code;
      setPickedCode(code);
      setQ(code);
      setDept(defaultDepartment(branch, code, hit[0].name));
      if (hit.length === 1) {
        setTicked((t) => ({ ...t, [hit[0].id]: String(hit[0].kg) }));
        setMsg(`Đã tick cuộn ${hit[0].coil_no}`);
      } else {
        setMsg(`${hit.length} cuộn cùng Lot ${s} — tick cuộn đúng bên dưới`);
      }
    },
    [coils, usedCoilIds, branch],
  );

  // ---- Thêm dòng --------------------------------------------------------
  function addLines() {
    setErr(''); setMsg('');
    const batchSeq = lines.length ? Math.max(...lines.map((l) => l.batch_seq)) : 0;
    const nextBatch = batchSeq + (lines.length ? 1 : 1);
    const time = hhmmVN();

    if (isNvl) {
      const ids = Object.keys(ticked).map(Number);
      if (ids.length === 0) { setErr('Chưa tick cuộn nào'); return; }
      const news: SlipLine[] = [];
      for (const id of ids) {
        const c = coils.find((x) => x.id === id);
        if (!c) continue;
        const kg = isReturn ? Number(ticked[id]) || 0 : c.kg;
        if (isReturn && kg <= 0) { setErr(`Cuộn ${c.coil_no}: Kg trả phải > 0`); return; }
        news.push({
          batch_seq: nextBatch, batch_time: time, batch_user: '',
          department: dept,
          material_code: c.code, material_name: c.name, material_spec: c.size,
          coil_id: c.id, coil_no: c.coil_no, lot_no: c.lot_no,
          qty: kg, unit: 'KG', note: lineNote || null,
        });
      }
      if (news.length === 0) { setErr('Không có cuộn hợp lệ'); return; }
      setLines((p) => [...p, ...news]);
    } else {
      if (!pickedAux) { setErr('Chưa chọn mã phụ liệu'); return; }
      const qty = Number(String(auxQty).replace(',', '.'));
      if (!(qty > 0)) { setErr('Số lượng phải lớn hơn 0'); return; }
      if (!isReturn) {
        if (pickedAux.stock <= 0) {
          setErr(`${pickedAux.code}: hết tồn kho — không xuất được`); return;
        }
        const already = lines
          .filter((l) => l.material_code === pickedAux.code)
          .reduce((s, l) => s + l.qty, 0);
        if (already + qty > pickedAux.stock) {
          setErr(
            `Vượt tồn kho: phiếu này đã có ${fmtQty(already)}, thêm ${fmtQty(qty)} ` +
              `> tồn ${fmtQty(pickedAux.stock)} ${pickedAux.unit}`,
          );
          return;
        }
      }
      setLines((p) => [...p, {
        batch_seq: nextBatch, batch_time: time, batch_user: '',
        department: dept,
        material_code: pickedAux.code, material_name: pickedAux.name,
        material_spec: [pickedAux.material, pickedAux.spec].filter(Boolean).join(' · '),
        coil_id: null, coil_no: null, lot_no: null,
        qty, unit: pickedAux.unit, note: lineNote || null,
      }]);
    }
    resetForm();
    setMsg('Đã thêm vào phiếu — nhớ bấm Lưu hoặc Gửi');
  }

  function removeLine(i: number) {
    setLines((p) => p.filter((_, idx) => idx !== i));
  }

  // ---- Lưu / Gửi --------------------------------------------------------
  async function save(send: boolean) {
    if (lines.length === 0) { setErr('Phiếu chưa có dòng nào'); return; }
    setSaving(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/nvl-slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, branch, send, note: slipNote, lines }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lưu thất bại');
      setMsg(
        send
          ? `Đã gửi lên app chính — chờ duyệt (phiếu ${d.uid})`
          : `Đã lưu ${d.n_lines} dòng (chưa gửi)`,
      );
      await loadSlip();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi lưu phiếu');
    } finally {
      setSaving(false);
    }
  }

  // ---- Render -----------------------------------------------------------
  // Bảng chưa tạo (chưa chạy migration 17) → Postgres báo 'relation ... does not exist'
  const needMigration = /does not exist|schema cache|relation/i.test(err);
  const st = slip ? STATUS_UI[slip.status] ?? STATUS_UI.draft : null;
  const locked = slip?.status === 'approved';
  const batches = useMemo(() => {
    const m = new Map<number, SlipLine[]>();
    lines.forEach((l) => {
      if (!m.has(l.batch_seq)) m.set(l.batch_seq, []);
      m.get(l.batch_seq)!.push(l);
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [lines]);

  return (
    <div className="space-y-4">
      {/* Nhánh Nguyên liệu / Phụ liệu */}
      <div className="grid grid-cols-2 gap-2">
        {(['nvl', 'aux'] as Branch[]).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => { setBranch(b); resetForm(); setMsg(''); setErr(''); }}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition ${
              branch === b
                ? 'bg-brand-teal text-white border-brand-teal shadow-md shadow-brand-teal/30'
                : 'bg-white text-brand-teal border-brand-teal/30'
            }`}
          >
            {BRANCH_LABEL[b]}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-brand-navy-soft">Đang tải…</p>}

      {/* Trạng thái phiếu */}
      {slip && st && (
        <div className={`rounded-xl border p-3 text-sm ${st.cls}`}>
          <div className="font-bold">{st.label}</div>
          <div className="text-xs mt-0.5">
            {KIND_LABEL[kind]} {BRANCH_LABEL[branch].toLowerCase()} · {slip.slip_date}
            {slip.seq > 1 && ` · phiếu #${slip.seq}`}
            {slip.created_by_name && ` · ${slip.created_by_name}`}
          </div>
          {slip.status === 'rejected' && slip.reject_reason && (
            <div className="mt-1.5 font-semibold">Lý do: {slip.reject_reason}</div>
          )}
          {slip.status === 'approved' && slip.main_refs?.length > 0 && (
            <div className="mt-1.5">
              Phiếu đã tạo:{' '}
              {slip.main_refs.map((r) => `${r.no} (${r.department})`).join(' · ')}
            </div>
          )}
          {slip.line_errors?.length > 0 && (
            <ul className="mt-1.5 list-disc pl-5 text-rose-700">
              {slip.line_errors.map((e, i) => (
                <li key={i}>
                  {e.seq ? `Dòng ${e.seq}: ` : ''}{e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {msg && <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-2.5">{msg}</div>}
      {err && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm p-2.5">
          {needMigration ? (
            <>
              <b>Chưa thiết lập bảng trên Supabase.</b> Cần chạy migration{' '}
              <code className="bg-rose-100 px-1 rounded">docs/sql/17-nvl-slips.sql</code>{' '}
              trên Supabase SQL Editor (mở New Query tab MỚI TRỐNG), rồi tải lại trang.
            </>
          ) : (
            err
          )}
        </div>
      )}

      {locked && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm p-2.5">
          Phiếu này đã duyệt. Ghi thêm trong ngày sẽ tự mở phiếu mới.
        </div>
      )}

      {/* Thêm dòng */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-brand-navy">
            ➕ {KIND_LABEL[kind]} {BRANCH_LABEL[branch].toLowerCase()}
          </h3>
          {stockAt && (
            <span className="text-[11px] text-brand-navy-soft">
              tồn lúc {new Date(new Date(stockAt).getTime() + 7 * 3600e3).toISOString().slice(11, 16)}
            </span>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-1">
            {isNvl ? 'Mã nguyên liệu' : 'Mã phụ liệu'}
          </label>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPickedCode(''); }}
              placeholder={isNvl ? 'Gõ mã / tên / size…' : 'Gõ mã / tên / quy cách…'}
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
            {isNvl && <BarcodeScanButton onScan={onScan} />}
          </div>

          {filtered.length > 0 && !pickedCode && (
            <ul className="mt-1 border border-gray-200 rounded-md divide-y max-h-64 overflow-auto">
              {isNvl
                ? (filtered as typeof nvlOptions).map((o) => (
                    <li key={o.code}>
                      <button
                        type="button"
                        onClick={() => pick(o.code, o.name)}
                        className="w-full text-left px-3 py-2 text-sm active:bg-brand-teal/10"
                      >
                        <span className="font-mono font-semibold">{o.code}</span> — {o.name}
                        {o.size && ` — ${o.size}`}
                        <span className={o.n ? 'text-brand-navy-soft' : 'text-rose-600 font-semibold'}>
                          {' '}— {o.n ? `${o.n} cuộn / ${fmtQty(o.kg)} kg` : 'hết tồn'}
                        </span>
                      </button>
                    </li>
                  ))
                : (filtered as StockAux[]).map((m) => (
                    <li key={m.code}>
                      <button
                        type="button"
                        onClick={() => pick(m.code, m.name)}
                        className="w-full text-left px-3 py-2 text-sm active:bg-brand-teal/10"
                      >
                        <span className="font-mono font-semibold">{m.code}</span> — {m.name}
                        {m.material && ` — ${m.material}`}
                        {m.spec && ` — ${m.spec}`}
                        <span className={m.stock > 0 ? 'text-brand-navy-soft' : 'text-rose-600 font-semibold'}>
                          {' '}— {m.stock > 0 ? `tồn ${fmtQty(m.stock)} ${m.unit}` : 'hết tồn kho'}
                        </span>
                      </button>
                    </li>
                  ))}
            </ul>
          )}
        </div>

        {/* Nguyên liệu: tick cuộn */}
        {isNvl && pickedCode && (
          <div>
            <div className="text-sm font-semibold text-brand-navy mb-1">
              Chọn cuộn {pickedNvl ? `(${coilsOfPicked.length} cuộn)` : ''}
            </div>
            {coilsOfPicked.length === 0 ? (
              <p className="text-sm text-rose-600 font-semibold">
                {isReturn
                  ? 'Không có cuộn nào của mã này đang ở line'
                  : 'Mã này hết tồn kho — không xuất được'}
              </p>
            ) : (
              <ul className="border border-gray-200 rounded-md divide-y max-h-72 overflow-auto">
                {coilsOfPicked.map((c) => {
                  const on = ticked[c.id] !== undefined;
                  return (
                    <li key={c.id} className="px-3 py-2 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setTicked((t) => {
                              const n = { ...t };
                              if (e.target.checked) n[c.id] = String(c.kg);
                              else delete n[c.id];
                              return n;
                            })
                          }
                          className="w-5 h-5"
                        />
                        <span className="flex-1">
                          <span className="font-mono">{c.coil_no}</span>
                          {c.lot_no && <span className="text-brand-navy-soft"> · {c.lot_no}</span>}
                          <span className="text-brand-navy-soft"> · {fmtQty(c.kg)} kg</span>
                        </span>
                      </label>
                      {/* Trả kho: sửa được Kg cân thực khi trả cuộn dở */}
                      {on && isReturn && (
                        <div className="mt-1 pl-7 flex items-center gap-2">
                          <span className="text-xs text-brand-navy-soft">Kg trả</span>
                          <input
                            inputMode="decimal"
                            value={ticked[c.id]}
                            onChange={(e) =>
                              setTicked((t) => ({ ...t, [c.id]: e.target.value }))
                            }
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span className="text-xs text-brand-navy-soft">
                            (nguyên cuộn {fmtQty(c.kg)})
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Phụ liệu: nhập số lượng */}
        {!isNvl && pickedAux && (
          <div>
            <label className="block text-sm font-semibold text-brand-navy mb-1">
              Số lượng ({pickedAux.unit}) — tồn {fmtQty(pickedAux.stock)}
            </label>
            <input
              inputMode="decimal"
              value={auxQty}
              onChange={(e) => setAuxQty(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md"
            />
            {!isReturn && pickedAux.stock <= 0 && (
              <p className="mt-1 text-sm text-rose-600 font-semibold">
                Hết tồn kho — không xuất được
              </p>
            )}
          </div>
        )}

        {pickedCode && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-1">Bộ phận</label>
                <select
                  value={dept}
                  onChange={(e) => setDept(e.target.value as Department)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md bg-white"
                >
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-1">Ghi chú</label>
                <input
                  value={lineNote}
                  onChange={(e) => setLineNote(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={addLines}
              className="w-full py-3 rounded-xl bg-brand-teal text-white font-bold active:scale-95 transition"
            >
              ➕ Thêm vào phiếu
            </button>
          </>
        )}
      </div>

      {/* Dòng đã có */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4">
        <h3 className="font-bold text-brand-navy mb-2">
          Phiếu hôm nay — {lines.length} dòng
          {lines.length > 0 && ` · ${fmtQty(lines.reduce((s, l) => s + l.qty, 0))} ${lines[0].unit}`}
        </h3>
        {lines.length === 0 ? (
          <p className="text-sm text-brand-navy-soft">Chưa có dòng nào.</p>
        ) : (
          batches.map(([bseq, bl]) => (
            <div key={bseq} className="mb-3">
              <div className="text-xs font-semibold text-brand-navy-soft mb-1">
                Đợt {bseq} · {bl[0].batch_time} · {bl.length} dòng
              </div>
              <ul className="divide-y border border-gray-100 rounded-md">
                {bl.map((l) => {
                  const i = lines.indexOf(l);
                  return (
                    <li key={i} className="px-2.5 py-2 text-sm flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div>
                          <span className="font-mono font-semibold">{l.material_code}</span>
                          <span className="text-brand-navy-soft"> · {l.department}</span>
                        </div>
                        <div className="text-xs text-brand-navy-soft truncate">
                          {l.material_name}
                          {l.coil_no && ` · ${l.coil_no}`}
                          {l.lot_no && ` · ${l.lot_no}`}
                          {l.note && ` · ${l.note}`}
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="font-semibold">{fmtQty(l.qty)} {l.unit}</div>
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="text-xs text-rose-600 font-semibold"
                          >
                            Xoá
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}

        <label className="block text-sm font-semibold text-brand-navy mt-3 mb-1">
          Ghi chú phiếu
        </label>
        <input
          value={slipNote}
          onChange={(e) => setSlipNote(e.target.value)}
          placeholder="Ghi chú sẽ hiện lên phiếu bên app chính"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-md"
        />

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            disabled={saving || lines.length === 0}
            onClick={() => save(false)}
            className="py-3 rounded-xl border border-brand-navy text-brand-navy font-bold disabled:opacity-40"
          >
            💾 Lưu
          </button>
          <button
            type="button"
            disabled={saving || lines.length === 0}
            onClick={() => save(true)}
            className="py-3 rounded-xl bg-brand-navy text-white font-bold disabled:opacity-40"
          >
            📤 Gửi lên app chính
          </button>
        </div>
        <p className="mt-2 text-[11px] text-brand-navy-soft">
          Quên bấm Gửi thì cuối ngày (16:15) máy tự gửi giúp. Tồn kho chỉ thay đổi khi
          app chính duyệt.
        </p>
      </div>

      {/* Lịch sử */}
      {events.length > 0 && (
        <details className="bg-white rounded-xl border border-brand-surface-alt p-4">
          <summary className="font-bold text-brand-navy cursor-pointer">
            Lịch sử chỉnh sửa ({events.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-brand-navy-soft">
            {events.map((e, i) => (
              <li key={i}>
                {new Date(new Date(e.at).getTime() + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ')}
                {' · '}{e.actor || '?'}{' · '}{e.action}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
