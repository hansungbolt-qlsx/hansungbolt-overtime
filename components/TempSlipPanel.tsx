'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultDepartment, matchAux, matchNvl,
  type Branch, type Department, type SlipLine, type StockAux, type StockCoil,
} from '@/lib/nvl-slips';
import {
  isStale, matchAllTempLines, type TempLine, type TempMatch,
} from '@/lib/nvl-temp';

// ===========================================================================
// PHIẾU XUẤT KHO TẠM — HÀNG CHƯA NHẬP KHO (user chốt 31/07/2026)
//
// Luồng: ghi tạm (mã + lot gõ tay + Kg gõ tay) → app chính nhập kho → tồn đẩy
// xuống → bấm KIỂM TRA → app chỉ ra cuộn khớp/lệch + gợi ý → chốt → dòng vào
// PHIẾU XUẤT KHO HÔM NAY.
//
// ⚠ Không tự đẩy gì lên app chính. Dòng chỉ rời khỏi đây khi người dùng bấm chốt.
// ===========================================================================

type MasterNvl = { id: number; code: string; name: string; size: string; unit: string };

function todayVN(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
function hhmmVN(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);
}
function ddmm(iso?: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}
const fmtQty = (n: number) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: 3 });

export default function TempSlipPanel({
  branch, coils, auxMats, nvlMaster, onMerge,
}: {
  branch: Branch;
  coils: StockCoil[];
  auxMats: StockAux[];
  nvlMaster: MasterNvl[];
  /** Đưa dòng đã chốt vào phiếu hôm nay. Trả true nếu ghi thành công. */
  onMerge: (lines: SlipLine[]) => Promise<boolean>;
}) {
  const isNvl = branch === 'nvl';

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TempLine[]>([]);
  const [merged, setMerged] = useState<TempLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  // Chưa chạy migration 22 → bảng chưa tồn tại. ẨN HẲN cả khối thay vì hiện lỗi
  // đỏ: nhân viên kho không cần biết chuyện kỹ thuật, và màn xuất kho hằng ngày
  // phải trông y như cũ cho tới khi tính năng thật sự sẵn sàng.
  const [notReady, setNotReady] = useState(false);

  // Form thêm dòng
  const [q, setQ] = useState('');
  const [pickedCode, setPickedCode] = useState('');
  const [realDate, setRealDate] = useState(todayVN());
  const [dept, setDept] = useState<Department>('Heading');
  const [lotTyped, setLotTyped] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  // Màn đối chiếu: dòng nào chốt cuộn nào (ghi đè gợi ý của app khi người tự chọn)
  const [checking, setChecking] = useState(false);
  const [override, setOverride] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch(`/api/nvl-temp?branch=${branch}`);
      const d = await r.json();
      if (!r.ok) {
        // Bảng chưa có (migration 22 chưa chạy) → ẩn khối, KHÔNG báo lỗi.
        if (/does not exist|schema cache|relation|nvl_temp_lines/i.test(d.error || '')) {
          setNotReady(true);
          return;
        }
        throw new Error(d.error || 'Không tải được phiếu tạm');
      }
      setNotReady(false);
      setRows((d.waiting ?? []).map((x: TempLine) => ({ ...x, qty: Number(x.qty) })));
      setMerged((d.merged ?? []).map((x: TempLine) => ({ ...x, qty: Number(x.qty) })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải phiếu tạm');
    }
  }, [branch]);

  // Nạp lại mỗi khi mở màn / đổi nhánh — user không phải nhớ bấm làm mới.
  useEffect(() => { void load(); }, [load]);

  // ---- Đối chiếu với tồn hiện có ----------------------------------------
  const matches: TempMatch[] = useMemo(
    () => (isNvl ? matchAllTempLines(rows, coils) : []),
    [isNvl, rows, coils],
  );

  /** Phụ liệu: "đã có tồn" = tồn hiện tại ≥ số đã gõ. */
  const auxStock = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of auxMats) m.set(a.code, a.stock);
    return m;
  }, [auxMats]);

  /** Dòng đã sẵn sàng chốt (NVL: có cuộn để ghép · PL: đủ tồn). */
  const ready = useMemo(() => {
    if (isNvl) {
      return matches.filter((m) => (override[m.line.id] ?? m.pick?.id ?? 0) > 0);
    }
    return rows
      .filter((r) => (auxStock.get(r.material_code) ?? 0) > 0)
      .map((r) => ({ line: r } as TempMatch));
  }, [isNvl, matches, rows, auxStock, override]);

  const nStale = rows.filter((r) => isStale(r)).length;

  // ---- Ô gợi ý mã --------------------------------------------------------
  const options = useMemo(() => {
    const s = q.trim();
    if (!s) return [];
    if (isNvl) {
      return nvlMaster
        .filter((m) => matchNvl(s, m.code, m.name, m.size))
        .slice(0, 30);
    }
    return auxMats
      .filter((a) => matchAux(s, a.code, a.name, a.material, a.spec))
      .slice(0, 30)
      .map((a) => ({ id: a.id, code: a.code, name: a.name, size: a.spec, unit: a.unit }));
  }, [q, isNvl, nvlMaster, auxMats]);

  const picked = useMemo(
    () => options.find((o) => o.code === pickedCode)
      ?? (isNvl ? nvlMaster.find((m) => m.code === pickedCode) : null),
    [options, pickedCode, isNvl, nvlMaster],
  );

  async function addRow() {
    setErr(''); setMsg('');
    if (!pickedCode) { setErr('Chưa chọn mã'); return; }
    const n = Number(String(qty).replace(',', '.'));
    if (!(n > 0)) { setErr('Số lượng phải lớn hơn 0'); return; }
    if (isNvl && !lotTyped.trim()) {
      // Không chặn cứng: hàng Vĩnh Thành có khi tem không ghi gì. Chỉ hỏi lại.
      if (!window.confirm(
        'Chưa gõ Lot / số hiệu cuộn.\n\nKhông có lot thì lúc đối chiếu app chỉ so được theo Kg.\nVẫn tiếp tục?',
      )) return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/nvl-temp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch,
          lines: [{
            real_date: realDate,
            department: dept,
            material_code: pickedCode,
            material_name: picked?.name ?? '',
            material_spec: picked?.size ?? '',
            lot_typed: lotTyped.trim(),
            qty: n,
            unit: isNvl ? 'KG' : (picked as { unit?: string })?.unit || 'EA',
            note: note.trim(),
          }],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lưu thất bại');
      // Giữ nguyên mã + ngày + bộ phận để gõ tiếp cuộn kế — mỗi cuộn 1 dòng.
      setLotTyped(''); setQty('');
      setMsg('Đã ghi dòng tạm — gõ tiếp cuộn kế nếu còn');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi ghi dòng tạm');
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: string) {
    if (!window.confirm('Xoá dòng tạm này?')) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch(`/api/nvl-temp?id=${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Xoá thất bại');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi xoá');
    } finally {
      setBusy(false);
    }
  }

  /** Chốt: ghi dòng vào phiếu hôm nay TRƯỚC, thành công mới đánh dấu đã chốt.
   *  Thứ tự này quan trọng — đánh dấu trước mà ghi phiếu hỏng là mất dòng. */
  async function confirmMerge() {
    setErr(''); setMsg('');
    if (ready.length === 0) { setErr('Chưa có dòng nào sẵn sàng chốt'); return; }

    const time = hhmmVN();
    const newLines: SlipLine[] = [];
    const patch: Array<{ id: string; coil_id?: number; coil_no?: string; lot_no?: string }> = [];

    for (const m of ready) {
      const ln = m.line;
      if (isNvl) {
        const coilId = override[ln.id] ?? m.pick?.id;
        const c = coils.find((x) => x.id === coilId);
        if (!c) continue;
        newLines.push({
          batch_seq: 1, batch_time: time, batch_user: '',
          department: ln.department,
          material_code: c.code, material_name: c.name, material_spec: c.size,
          coil_id: c.id, coil_no: c.coil_no, lot_no: c.lot_no,
          // Kg lấy theo CUỘN THẬT, không lấy số gõ tay (xuất nguyên cuộn).
          qty: c.kg, unit: 'KG',
          note: ln.note || null, reason: null,
          real_date: ln.real_date,
        });
        patch.push({ id: ln.id, coil_id: c.id, coil_no: c.coil_no, lot_no: c.lot_no });
      } else {
        const stock = auxStock.get(ln.material_code) ?? 0;
        const q2 = Math.min(ln.qty, stock);
        if (!(q2 > 0)) continue;
        if (q2 < ln.qty && !window.confirm(
          `${ln.material_code}: tồn hiện có ${fmtQty(stock)} nhưng dòng tạm ghi ${fmtQty(ln.qty)}.\n\n`
          + `Chốt ${fmtQty(q2)} theo tồn thật?`,
        )) continue;
        newLines.push({
          batch_seq: 1, batch_time: time, batch_user: '',
          department: ln.department,
          material_code: ln.material_code,
          material_name: ln.material_name ?? '', material_spec: ln.material_spec ?? '',
          qty: q2, unit: ln.unit,
          note: ln.note || null, reason: null,
          real_date: ln.real_date,
        });
        patch.push({ id: ln.id });
      }
    }

    if (newLines.length === 0) { setErr('Không có dòng hợp lệ để chốt'); return; }

    setBusy(true);
    try {
      const ok = await onMerge(newLines);
      if (!ok) throw new Error('Ghi vào phiếu hôm nay thất bại — dòng tạm giữ nguyên');
      const r = await fetch('/api/nvl-temp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: patch }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Đánh dấu đã chốt thất bại');
      setMsg(`Đã đưa ${newLines.length} dòng vào phiếu hôm nay`);
      setChecking(false); setOverride({});
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi chốt dòng');
    } finally {
      setBusy(false);
    }
  }

  // ---- Render ------------------------------------------------------------
  // Chưa chạy migration → màn xuất kho giữ nguyên như trước, không thừa thứ gì.
  if (notReady) return null;

  const badge = rows.length > 0
    ? `${rows.length} dòng chờ${ready.length > 0 ? ` · ${ready.length} đã có tồn` : ''}`
    : 'chưa có dòng nào';

  return (
    // MÀU CAM = KHU VỰC TẠM (user chốt 31/7). Phiếu xuất kho chính nền trắng
    // chữ xanh navy; khối này cam + vạch cam bên trái để nhìn phát biết ngay
    // đang ở vùng "hàng chưa nhập kho", không nhầm với phiếu thật.
    // Hai trạng thái CẦN CHÚ Ý vẫn thắng màu nền: xanh = đã có tồn (chốt được),
    // đỏ = có dòng treo quá 24h.
    <div className={`rounded-xl border border-l-4 overflow-hidden ${
      ready.length > 0 ? 'border-emerald-400 border-l-emerald-500 bg-emerald-50'
        : nStale > 0 ? 'border-rose-400 border-l-rose-500 bg-rose-50'
          : 'border-amber-300 border-l-amber-500 bg-amber-50'
    }`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
      >
        <span className={`font-bold text-sm ${
          ready.length > 0 ? 'text-emerald-800'
            : nStale > 0 ? 'text-rose-800' : 'text-amber-800'
        }`}>
          🕓 Phiếu xuất kho tạm — Hàng chưa nhập kho
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {ready.length > 0 && (
            <span className="rounded-full bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5">
              ĐÃ CÓ TỒN
            </span>
          )}
          {nStale > 0 && (
            <span className="rounded-full bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5">
              {nStale} treo &gt;24h
            </span>
          )}
          <span className="text-xs text-amber-900/70">{badge}</span>
          <span className="text-amber-700">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-black/5 pt-3">
          {err && <p className="text-sm text-rose-700 font-semibold">⛔ {err}</p>}
          {msg && <p className="text-sm text-emerald-700 font-semibold">✓ {msg}</p>}

          <p className="text-xs text-amber-900/80 leading-relaxed">
            Dùng khi hàng về gấp, đưa vào máy trước lúc kho nhập lên app.
            Ghi <b>mỗi cuộn một dòng</b> (lot + Kg đọc trên tem). Khi app chính nhập kho xong,
            quay lại đây bấm <b>Kiểm tra</b> để chốt cuộn rồi đưa vào phiếu hôm nay.
            <br />
            <b>Ô Lot phải gõ đúng số in trên tem cuộn</b> — gõ tên nhà cung cấp thì
            app không dò được cuộn. Mã <b>đang còn tồn vẫn chọn được</b> (tồn cũ có
            thể là hàng NG nên hàng mới về vẫn phải xuất ngay).
          </p>

          {/* ---- Danh sách dòng đang chờ ---- */}
          {rows.length === 0 ? (
            <p className="text-sm text-amber-900/70">Chưa có dòng tạm nào.</p>
          ) : (
            <ul className="divide-y border border-black/5 rounded-lg bg-white">
              {rows.map((r) => {
                const m = matches.find((x) => x.line.id === r.id);
                const stale = isStale(r);
                const hasStock = isNvl
                  ? (override[r.id] ?? m?.pick?.id ?? 0) > 0
                  : (auxStock.get(r.material_code) ?? 0) > 0;
                return (
                  <li key={r.id} className="px-2.5 py-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-brand-navy truncate">
                          {r.material_code}
                          {r.material_spec ? <span className="font-normal text-brand-navy-soft"> · {r.material_spec}</span> : null}
                          <span className="text-orange-600"> · {fmtQty(r.qty)} {r.unit}</span>
                        </div>
                        <div className="text-xs text-brand-navy-soft">
                          {isNvl && <>Lot gõ tay: <b>{r.lot_typed || '—'}</b> · </>}
                          Xuất thực tế {ddmm(r.real_date)} · {r.department}
                          {stale && <span className="text-rose-700 font-bold"> · treo &gt;24h</span>}
                        </div>
                        {isNvl && m && (
                          <div className={`text-xs mt-0.5 ${
                            m.verdict === 'exact' ? 'text-emerald-700'
                              : m.verdict === 'kg_only' ? 'text-amber-700' : 'text-brand-navy-soft'
                          }`}>
                            {m.verdict === 'exact' ? '✓ ' : m.verdict === 'kg_only' ? '⚠ ' : '· '}
                            {m.reason}
                          </div>
                        )}
                        {!isNvl && (
                          <div className={`text-xs mt-0.5 ${hasStock ? 'text-emerald-700' : 'text-brand-navy-soft'}`}>
                            {hasStock
                              ? `✓ Tồn hiện có ${fmtQty(auxStock.get(r.material_code) ?? 0)}`
                              : '· Chưa có tồn'}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeRow(r.id)}
                        disabled={busy}
                        className="shrink-0 text-xs text-rose-600 font-semibold px-2 py-1"
                      >
                        Xoá
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* ---- Màn đối chiếu / chốt ---- */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                <input
                  type="checkbox"
                  checked={checking}
                  onChange={(e) => { setChecking(e.target.checked); setOverride({}); }}
                  className="w-4 h-4"
                />
                Kiểm tra &amp; chốt cuộn theo tồn kho app chính
              </label>

              {checking && isNvl && (
                <div className="space-y-2">
                  {matches.map((m) => {
                    const chosen = override[m.line.id] ?? m.pick?.id ?? 0;
                    return (
                      <div key={m.line.id} className="rounded-lg border border-black/10 bg-white p-2">
                        <div className="text-sm font-semibold text-brand-navy">
                          {m.line.material_code} · {fmtQty(m.line.qty)} Kg
                          {m.line.lot_typed ? ` · lot gõ: ${m.line.lot_typed}` : ''}
                        </div>
                        <div className={`text-xs mb-1 ${
                          m.verdict === 'exact' ? 'text-emerald-700'
                            : m.verdict === 'kg_only' ? 'text-amber-700' : 'text-rose-700'
                        }`}>
                          {m.reason}
                        </div>
                        {m.candidates.length === 0 ? (
                          <p className="text-xs text-brand-navy-soft">Chưa có cuộn nào để chọn.</p>
                        ) : (
                          <select
                            value={chosen}
                            onChange={(e) => setOverride((p) => ({
                              ...p, [m.line.id]: Number(e.target.value),
                            }))}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                          >
                            <option value={0}>— chưa chọn cuộn —</option>
                            {m.candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {(c.lot_no || c.coil_no)} · {fmtQty(c.kg)} Kg
                                {c.received_at ? ` · nhập ${ddmm(c.received_at)}` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {checking && (
                <button
                  type="button"
                  onClick={() => void confirmMerge()}
                  disabled={busy || ready.length === 0}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50"
                >
                  ➕ Thêm {ready.length} dòng vào phiếu xuất kho hôm nay
                </button>
              )}
            </div>
          )}

          {/* ---- Thêm dòng tạm mới ---- */}
          <details className="rounded-lg border border-amber-300 bg-white">
            <summary className="px-2.5 py-2 text-sm font-semibold text-amber-800 cursor-pointer">
              ➕ Ghi dòng xuất tạm (hàng chưa nhập kho)
            </summary>
            <div className="px-2.5 pb-2.5 space-y-2">
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPickedCode(''); }}
                placeholder={isNvl ? 'Tìm mã NVL…' : 'Tìm mã phụ liệu…'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              {options.length > 0 && !pickedCode && (
                <ul className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y">
                  {options.map((o) => (
                    <li key={o.code}>
                      <button
                        type="button"
                        onClick={() => {
                          setPickedCode(o.code); setQ(o.code);
                          setDept(defaultDepartment(branch, o.code, o.name));
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-brand-surface"
                      >
                        <b>{o.code}</b> <span className="text-brand-navy-soft">{o.name} {o.size}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pickedCode && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-brand-navy-soft">
                      Ngày xuất thực tế
                      <input
                        type="date"
                        value={realDate}
                        max={todayVN()}
                        onChange={(e) => setRealDate(e.target.value || todayVN())}
                        className="w-full mt-0.5 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </label>
                    <label className="text-xs text-brand-navy-soft">
                      Bộ phận
                      <select
                        value={dept}
                        onChange={(e) => setDept(e.target.value as Department)}
                        className="w-full mt-0.5 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="Heading">Heading</option>
                        <option value="Rolling">Rolling</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {isNvl && (
                      <label className="text-xs text-brand-navy-soft">
                        Lot / số hiệu cuộn (trên tem)
                        <input
                          value={lotTyped}
                          onChange={(e) => setLotTyped(e.target.value)}
                          className="w-full mt-0.5 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                        />
                      </label>
                    )}
                    <label className="text-xs text-brand-navy-soft">
                      {isNvl ? 'Kg (trên tem)' : 'Số lượng'}
                      <input
                        inputMode="decimal"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="w-full mt-0.5 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </label>
                  </div>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú (không bắt buộc)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void addRow()}
                    disabled={busy}
                    className="w-full py-2 rounded-xl bg-amber-600 text-white font-bold text-sm disabled:opacity-50"
                  >
                    Ghi dòng tạm
                  </button>
                </>
              )}
            </div>
          </details>

          {/* ---- Đã chốt gần đây ---- */}
          {merged.length > 0 && (
            <details className="rounded-lg border border-amber-200 bg-white">
              <summary className="px-2.5 py-2 text-sm font-semibold text-amber-800 cursor-pointer">
                ✓ Đã chốt 7 ngày gần đây ({merged.length})
              </summary>
              <ul className="px-2.5 pb-2.5 text-xs text-brand-navy-soft space-y-1">
                {merged.map((r) => (
                  <li key={r.id}>
                    {ddmm(r.real_date)} · <b>{r.material_code}</b> · {fmtQty(r.qty)} {r.unit}
                    {r.merged_lot_no || r.merged_coil_no
                      ? ` → ${r.merged_lot_no || r.merged_coil_no}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
