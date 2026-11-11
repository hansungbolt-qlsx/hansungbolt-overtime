'use client';

// 🎨 KHO SƠN COATING (anh Hữu chốt 11/11/2026) — bộ phận CO. 3 phần:
//   ① Tồn kho theo lô (Tồn Main) + Tồn Line — số app chính tính, trừ tạm phiếu chưa tới app chính
//   ② Xuất sơn (tổ trưởng): chọn vật tư + TỔNG số lượng → app tự chia lô cũ trước; [Đổi lô] được nhưng phải ghi lý do
//      khi còn lô cũ hơn; lô hết hạn vẫn xuất được, có cảnh báo; 1 phiếu nhiều vật tư
//   ③ Phiếu đã gửi: ⏳ chờ / ● đã vào app Coating / ✎ sửa n lần / ✖ huỷ — người lập sửa / huỷ trong 7 ngày (bắt lý do)
// Lõi: lib/kho-son.ts · API: app/api/kho-son/route.ts · app chính: services/coating_kho.py

import { useCallback, useEffect, useMemo, useState } from 'react';
import { vnToday } from '@/lib/co-day';
import {
  KS_SUA_NGAY, chiaFifo, duocSua, hanVN, kiemDongKs, tonTam, type KsDong, type KsPhieu, type KsSanPham, type KsTon,
} from '@/lib/kho-son';

type Dong = Omit<KsDong, 'line_id'>;
const so = (n: number, max = 3) => n.toLocaleString('vi-VN', { maximumFractionDigits: max });
const MAU = { tot: 'bg-emerald-50 border-emerald-200 text-emerald-800', sap: 'bg-orange-50 border-orange-300 text-orange-800',
  het: 'bg-red-50 border-red-300 text-red-800' } as const;
const VONG = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

export default function KhoSonView({ onChuaLuu }: { onChuaLuu?: (canhBao: string) => void }) {
  const [ton, setTon] = useState<KsTon | null>(null);
  const [phieu, setPhieu] = useState<KsPhieu[]>([]);
  const [userId, setUserId] = useState('');
  const [duocXuat, setDuocXuat] = useState(false);
  const [taiLoi, setTaiLoi] = useState('');
  const [ngay, setNgay] = useState(vnToday());
  const [gio, setGio] = useState<Dong[]>([]);
  const [chonSp, setChonSp] = useState('');
  const [sl, setSl] = useState('');
  const [sua, setSua] = useState<{ so_phieu: string; version: number } | null>(null);
  const [lyDo, setLyDo] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mo, setMo] = useState('');

  const docVe = async () => {
    try {
      const r = await fetch('/api/kho-son', { cache: 'no-store' });
      return { ok: r.ok, j: await r.json() };
    } catch { return { ok: false, j: { error: 'Mất mạng — bấm Tải lại' } }; }
  };
  const apDung = useCallback(({ ok, j }: { ok: boolean; j: Record<string, unknown> }) => {
    if (!ok) { setTaiLoi(String(j.error || 'Lỗi tải')); return; }
    setTon((j.ton as KsTon) ?? { ok: false, loi: 'agent chưa đẩy số tồn', san_pham: [] });
    setPhieu((j.phieu as KsPhieu[]) || []); setUserId(String(j.user_id || '')); setDuocXuat(!!j.duoc_xuat); setTaiLoi('');
  }, []);
  const tai = useCallback(async () => apDung(await docVe()), [apDung]);
  useEffect(() => {
    let song = true;
    docVe().then((kq) => { if (song) apDung(kq); });
    return () => { song = false; };
  }, [apDung]);

  const canhBao = gio.length ? `Phiếu xuất sơn còn ${gio.length} dòng chưa Gửi` : '';
  useEffect(() => { onChuaLuu?.(canhBao); return () => onChuaLuu?.(''); }, [canhBao, onChuaLuu]);

  const spMap = useMemo(() => new Map((ton?.san_pham || []).map((p) => [p.product_id, p])), [ton]);
  // tồn còn được chọn = tồn tạm (trừ phiếu chưa tới app chính) − các dòng đang nằm trong giỏ
  const tonLo = useMemo(() => tonTam(ton, phieu, sua?.so_phieu), [ton, phieu, sua]);
  const conLai = useMemo(() => {
    const m = { ...tonLo };
    for (const d of gio) m[d.lot_id] = (m[d.lot_id] || 0) - d.qty;
    return m;
  }, [tonLo, gio]);
  const sp = spMap.get(chonSp);

  const themDong = () => {
    setMsg(null);
    if (!sp) return;
    const q = Number(sl.replace(',', '.'));
    if (!(q > 0)) return setMsg({ ok: false, text: 'Nhập số lượng lớn hơn 0' });
    if (sp.la_thung && !Number.isInteger(q)) return setMsg({ ok: false, text: 'Sơn xuất nguyên thùng — nhập số thùng (số nguyên)' });
    const chia = chiaFifo(sp, q, conLai);
    if (!chia) return setMsg({ ok: false, text: `${sp.code}: vượt tồn (còn ${so(sp.lo.reduce((a, l) => a + Math.max(0, conLai[l.lot_id] || 0), 0))} ${sp.don_vi})` });
    const moi = [...gio];
    for (const c of chia) {
      const l = sp.lo.find((x) => x.lot_id === c.lot_id)!;
      const cu = moi.find((d) => d.lot_id === c.lot_id);
      if (cu) cu.qty = Math.round((cu.qty + c.qty) * 1000) / 1000;
      else moi.push({ product_id: sp.product_id, lot_id: c.lot_id, qty: c.qty, het_han: l.muc === 'het' ? hanVN(l.han) : null });
    }
    setGio(moi); setSl('');
  };

  // Đổi lô 1 dòng: còn lô xếp trước (cũ hơn) chưa hết → bắt lý do
  const doiLo = (i: number, lotMoi: string) => {
    const d = gio[i];
    const p = spMap.get(d.product_id)!;
    const idx = p.lo.findIndex((l) => l.lot_id === lotMoi);
    const conCu = p.lo.slice(0, idx).filter((l) => l.lot_id !== d.lot_id && (conLai[l.lot_id] || 0) > 0);
    let ly: string | null = null;
    if (conCu.length) {
      ly = window.prompt(`Còn lô cũ hơn chưa xuất hết (${conCu.map((l) => l.lot_no || 'không số').join(', ')}). Lý do đổi lô?`);
      if (!ly || !ly.trim()) return;
    }
    const l = p.lo[idx];
    setGio(gio.map((x, j) => (j === i ? { ...x, lot_id: lotMoi, doi_lo_ly_do: ly?.trim() || null,
      het_han: l.muc === 'het' ? hanVN(l.han) : null } : x)));
  };

  const loiGio = gio.length ? kiemDongKs(gio.map((d, i) => ({ ...d, line_id: String(i) })), ton, tonLo) : null;

  const gui = async () => {
    if (loiGio) return setMsg({ ok: false, text: loiGio });
    if (sua && !lyDo.trim()) return setMsg({ ok: false, text: 'Ghi lý do sửa phiếu' });
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/kho-son', {
        method: sua ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sua ? { ...sua, action: 'sua', reason: lyDo, lines: gio } : { ngay, lines: gio }),
      });
      const j = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: j.error || 'Lỗi gửi' }); return; }
      setMsg({ ok: true, text: sua ? `Đã sửa ${sua.so_phieu}` : `Đã gửi ${j.so_phieu} — chờ đồng bộ app Coating` });
      setGio([]); setSua(null); setLyDo('');
      await tai();
    } finally { setBusy(false); }
  };

  const batDauSua = (p: KsPhieu) => {
    setSua({ so_phieu: p.so_phieu, version: p.version });
    setGio(p.lines.map((d) => ({ product_id: d.product_id, lot_id: d.lot_id, qty: d.qty, doi_lo_ly_do: d.doi_lo_ly_do, het_han: d.het_han })));
    setNgay(p.ngay); setLyDo(''); setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const huy = async (p: KsPhieu) => {
    const ly = window.prompt(`Huỷ phiếu ${p.so_phieu}? Ghi lý do:`);
    if (!ly || !ly.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/kho-son', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ so_phieu: p.so_phieu, version: p.version, action: 'huy', reason: ly }) });
      const j = await r.json();
      setMsg(r.ok ? { ok: true, text: `Đã huỷ ${p.so_phieu}` } : { ok: false, text: j.error || 'Lỗi huỷ' });
      await tai();
    } finally { setBusy(false); }
  };

  const tenDong = (d: Dong) => {
    const p = spMap.get(d.product_id);
    const l = p?.lo.find((x) => x.lot_id === d.lot_id);
    return { p, l, kg: p?.la_thung ? d.qty * p.kg_moi_dv : null };
  };

  if (taiLoi) return <div className="bg-white rounded-xl border p-4 text-sm text-red-700">{taiLoi}</div>;
  if (!ton) return <div className="bg-white rounded-xl border p-4 text-sm text-gray-500">Đang tải tồn kho…</div>;
  if (!ton.ok) return <div className="bg-white rounded-xl border p-4 text-sm text-orange-700">Chưa có số tồn từ app chính ({ton.loi || 'máy chủ đang tắt'}).</div>;

  return (
    <div className="space-y-3">
      {/* ① TỒN KHO */}
      <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-3">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-bold text-brand-navy">Tồn kho</h2>
          <span className="text-xs text-gray-500">cập nhật {ton.at ? new Date(ton.at).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
        <div className="space-y-2">
          {ton.san_pham.map((p: KsSanPham) => {
            const tong = p.lo.reduce((a, l) => a + (tonLo[l.lot_id] ?? 0), 0);
            return (
              <div key={p.product_id} className="border rounded-lg p-2">
                <div className="text-sm font-bold">{p.code} · {p.ten}</div>
                <div className="flex justify-between gap-2 text-sm">
                  <span>Main <b>{so(tong)}</b> {p.don_vi}{p.la_thung ? ` (${so(tong * p.kg_moi_dv, 2)} kg)` : ''}</span>
                  {p.co_line && <span>Line <b className={(p.line_kg ?? 0) < 0 ? 'text-red-600' : 'text-teal-700'}>{so(p.line_kg ?? 0, 2)} kg</b></span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.lo.filter((l) => (tonLo[l.lot_id] ?? 0) > 0).map((l, i) => (
                    <span key={l.lot_id} className={`text-xs border rounded px-1.5 py-0.5 ${MAU[l.muc]}`}>
                      {VONG[i] ?? `${i + 1}.`} {l.lot_no || 'lô'}: {so(tonLo[l.lot_id])}
                      {l.han && ` · ${hanVN(l.han).slice(0, 5)}/${l.han.slice(2, 4)}`}{l.muc === 'het' && ' hết hạn'}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {!!ton.chua_dinh_muc?.length && (
          <p className="text-xs text-orange-700 mt-2">⚠ Mã chưa có định mức keo (chưa trừ Tồn Line): {ton.chua_dinh_muc.map((x) => x.ma).join(', ')}</p>
        )}
      </section>

      {/* ② XUẤT SƠN */}
      {duocXuat && (
        <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-3 space-y-2">
          <h2 className="font-bold text-brand-navy">{sua ? `Sửa phiếu ${sua.so_phieu}` : 'Xuất sơn'}</h2>
          <label className="flex items-center justify-between text-sm gap-2">Ngày xuất
            <input type="date" value={ngay} max={vnToday()} disabled={!!sua} onChange={(e) => setNgay(e.target.value)}
              className="border rounded px-2 py-1" />
          </label>
          <div className="flex gap-2">
            <select value={chonSp} onChange={(e) => { setChonSp(e.target.value); setSl(''); }} className="flex-1 border rounded px-2 py-2 text-sm">
              <option value="">— Chọn vật tư —</option>
              {ton.san_pham.map((p) => <option key={p.product_id} value={p.product_id}>{p.code} · {p.ten}</option>)}
            </select>
            <input inputMode={sp?.la_thung ? 'numeric' : 'decimal'} value={sl} onChange={(e) => setSl(e.target.value)}
              placeholder={sp ? (sp.la_thung ? 'số thùng' : sp.don_vi) : 'SL'} className="w-24 border rounded px-2 py-2 text-sm" />
            <button type="button" onClick={themDong} disabled={!sp || !sl} className="px-3 rounded bg-teal-600 text-white text-sm font-semibold disabled:opacity-40">Thêm</button>
          </div>
          {sp?.la_thung && Number(sl) > 0 && <p className="text-xs text-gray-600">= {so(Number(sl) * sp.kg_moi_dv, 2)} kg</p>}

          {gio.map((d, i) => {
            const { p, kg } = tenDong(d);
            return (
              <div key={i} className={`border rounded-lg p-2 text-sm ${d.het_han ? 'border-red-300 bg-red-50' : ''}`}>
                <div className="flex justify-between gap-2">
                  <span><b>{p?.code}</b> · <b>{so(d.qty)}</b> {p?.don_vi}{kg != null && ` (${so(kg, 2)} kg)`}</span>
                  <button type="button" onClick={() => setGio(gio.filter((_, j) => j !== i))} className="text-red-600 text-xs">Bỏ</button>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  Lô
                  <select value={d.lot_id} onChange={(e) => doiLo(i, e.target.value)} className="border rounded px-1 py-0.5">
                    {p?.lo.filter((x) => x.lot_id === d.lot_id || (conLai[x.lot_id] || 0) >= d.qty).map((x) => (
                      <option key={x.lot_id} value={x.lot_id}>{x.lot_no || 'không số'}{x.han ? ` · HSD ${hanVN(x.han)}` : ''}</option>
                    ))}
                  </select>
                </div>
                {d.het_han && <p className="text-xs text-red-700 mt-1">⚠ Lô đã hết hạn ngày {d.het_han} — vẫn xuất được, phiếu ghi cảnh báo</p>}
                {d.doi_lo_ly_do && <p className="text-xs text-orange-700 mt-1">Đổi lô: {d.doi_lo_ly_do}</p>}
              </div>
            );
          })}
          {sua && <input value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Lý do sửa (bắt buộc)" className="w-full border rounded px-2 py-2 text-sm" />}
          {msg && <p className={`text-sm ${msg.ok ? 'text-teal-700' : 'text-red-700'}`}>{msg.text}</p>}
          {loiGio && <p className="text-sm text-red-700">{loiGio}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={gui} disabled={busy || !gio.length || !!loiGio}
              className="flex-1 py-2.5 rounded-lg bg-brand-navy text-white font-bold disabled:opacity-40">
              {busy ? 'Đang gửi…' : sua ? 'Lưu sửa' : `Gửi phiếu (${gio.length} dòng)`}
            </button>
            {(sua || gio.length > 0) && (
              <button type="button" onClick={() => { setGio([]); setSua(null); setLyDo(''); setNgay(vnToday()); setMsg(null); }}
                className="px-3 rounded-lg border text-sm">Bỏ</button>
            )}
          </div>
        </section>
      )}

      {/* ③ PHIẾU ĐÃ GỬI */}
      <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-3">
        <div className="flex justify-between items-baseline mb-2">
          <h2 className="font-bold text-brand-navy">Phiếu đã gửi (30 ngày)</h2>
          <button type="button" onClick={tai} className="text-xs text-teal-700">Tải lại</button>
        </div>
        {!phieu.length && <p className="text-sm text-gray-500">Chưa có phiếu.</p>}
        <div className="space-y-2">
          {phieu.map((p) => {
            const nSua = (p.history || []).filter((h) => h.action === 'sua').length;
            const tt = p.status === 'cancelled' ? '✖ Đã huỷ' : p.last_error ? `⚠ ${p.last_error}`
              : p.status === 'synced' ? '● Đã vào app Coating' : '⏳ Chờ đồng bộ';
            return (
              <div key={p.so_phieu} className={`border rounded-lg p-2 text-sm ${p.status === 'cancelled' ? 'opacity-60' : ''}`}>
                <button type="button" onClick={() => setMo(mo === p.so_phieu ? '' : p.so_phieu)} className="w-full text-left">
                  <div className="flex justify-between gap-2">
                    <b>{p.so_phieu}{nSua ? ` ✎${nSua}` : ''}</b>
                    <span className="text-xs">{hanVN(p.ngay)} · {p.created_by_name}</span>
                  </div>
                  <div className={`text-xs ${p.last_error ? 'text-red-700' : p.status === 'synced' ? 'text-teal-700' : 'text-gray-600'}`}>{tt}</div>
                  {p.lines.map((d) => {
                    const { p: s, l, kg } = tenDong(d);
                    return <div key={d.line_id} className={`text-xs ${p.status === 'cancelled' ? 'line-through' : ''}`}>
                      {s?.code ?? d.product_id} · {l?.lot_no || '—'} · <b>{so(d.qty)}</b> {s?.don_vi}{kg != null && ` (${so(kg, 2)} kg)`}{d.het_han && ' · hết hạn'}
                    </div>;
                  })}
                </button>
                {mo === p.so_phieu && (
                  <div className="mt-2 border-t pt-2 space-y-1 text-xs">
                    {(p.history || []).map((h) => (
                      <div key={h.v}>v{h.v} · {new Date(h.at).toLocaleString('vi-VN', { hour12: false })} · {h.by} · {h.action === 'huy' ? 'Huỷ' : 'Sửa'}: {h.reason}</div>
                    ))}
                    {p.cancel_reason && <div>Lý do huỷ: {p.cancel_reason}</div>}
                    {duocSua(p, userId) ? (
                      <div className="flex gap-2 pt-1">
                        <button type="button" disabled={busy} onClick={() => batDauSua(p)} className="px-3 py-1 rounded border border-teal-600 text-teal-700">Sửa</button>
                        <button type="button" disabled={busy} onClick={() => huy(p)} className="px-3 py-1 rounded border border-red-500 text-red-600">Huỷ</button>
                      </div>
                    ) : p.status !== 'cancelled' && (
                      <div className="text-gray-500">Chỉ người lập sửa / huỷ trong {KS_SUA_NGAY} ngày. Cần sửa: báo admin app Coating.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
