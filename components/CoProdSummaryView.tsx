'use client';

// TỔNG HỢP SẢN LƯỢNG theo ngày — bộ phận Coating (anh Hữu chốt 06/10/2026).
// 2 khối: Công đoạn CO (86) · Công đoạn AB (84). Mỗi khối: từng mã hàng làm trong ngày → Σ Kg + Σ EA
// (EA = Kg × 1000 ÷ trọng lượng thành phẩm 1 EA trên ERP). Tính cả dòng chưa bấm Gửi. Chọn ngày = xem lại ngày cũ.
import { Fragment, useEffect, useState } from 'react';
import DateButton from './DateButton';

type Item = { item_code: string; item_name: string; n_lot: number; kg: number; g_ea: number | null; ea: number | null;
  lots?: { lot: string; kg: number; ea: number | null }[] };
type Block = {
  stage: '86' | '84'; short: string; status: 'draft' | 'pending' | 'received' | null;
  n_lot: number; total_kg: number; total_ea: number; n_no_g: number; items: Item[];
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shift = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const fmtKg = (v: number) => v.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtEa = (v: number) => v.toLocaleString('vi-VN');

const TITLE: Record<Block['stage'], string> = { '86': 'Công đoạn CO (86)', '84': 'Công đoạn AB (84)' };
const COLOR: Record<Block['stage'], string> = { '86': 'bg-[#ea580c]', '84': 'bg-[#7c3aed]' };
const STATUS: Record<string, string> = {
  draft: '📝 chưa gửi app chính', pending: '📤 đang đẩy sang app chính', received: '✅ app chính đã nhận',
};

export default function CoProdSummaryView() {
  const [date, setDate] = useState(todayISO());
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [err, setErr] = useState('');
  // Mã đang mở chi tiết LOT ('86|080290-FM6R-D') — bấm số LOT để mở/đóng (anh Hữu 07/10/2026)
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/co-summary?date=${date}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) { setErr(j.error || 'Không tải được tổng hợp'); setBlocks([]); return; }
        setErr(''); setBlocks(j.stages ?? []);
      })
      .catch(() => { if (!cancelled) { setErr('Không tải được tổng hợp'); setBlocks([]); } });
    return () => { cancelled = true; };
  }, [date]);

  const isToday = date === todayISO();
  const nav = 'px-3 py-2 rounded-lg border border-brand-surface-alt bg-white text-brand-navy font-bold active:scale-95';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-2">
        <div className="text-sm font-bold text-brand-navy">📊 Tổng hợp sản lượng {isToday ? 'hôm nay' : 'theo ngày'}</div>
        <div className="flex items-center gap-2">
          <button type="button" className={nav} onClick={() => setDate(shift(date, -1))} aria-label="Ngày trước">←</button>
          <DateButton value={date} onChange={(v) => v && setDate(v)} className="flex-1 justify-center" />
          <button type="button" className={nav} onClick={() => setDate(shift(date, 1))} aria-label="Ngày sau">→</button>
        </div>
        <p className="text-[11px] text-brand-navy-soft">
          Số lượng (EA) = Trọng lượng (Kg) × 1000 ÷ trọng lượng thành phẩm 1 EA của mã hàng trên ERP, làm tròn từng LOT rồi cộng. Tính cả các dòng chưa bấm Gửi.
        </p>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>

      {blocks === null && <p className="text-sm text-brand-navy-soft text-center">Đang tải…</p>}

      {(blocks ?? []).map((b) => (
        <div key={b.stage} className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
          <div className={`${COLOR[b.stage]} text-white px-4 py-2.5 flex items-center justify-between gap-2`}>
            <div className="font-bold">{TITLE[b.stage]}</div>
            <div className="text-xs">{b.status ? STATUS[b.status] : 'chưa có phiếu'}</div>
          </div>
          {b.items.length === 0 ? (
            <p className="p-4 text-sm text-brand-navy-soft text-center">Chưa có sản lượng ngày này.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-brand-navy text-xs">
                    <th className="px-3 py-2 text-left">Mã hàng</th>
                    <th className="px-2 py-2 text-right">LOT</th>
                    <th className="px-2 py-2 text-right">Trọng lượng (Kg)</th>
                    <th className="px-3 py-2 text-right">Số lượng (EA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-surface-alt">
                  {b.items.map((it) => {
                    const key = `${b.stage}|${it.item_code}`;
                    const isOpen = open === key;
                    return (
                    <Fragment key={it.item_code}>
                    <tr className={isOpen ? 'bg-sky-50' : ''}>
                      {/* Chỉ mã hàng, không tên (anh Hữu 07/10/2026) */}
                      <td className="px-3 py-2 font-bold text-brand-navy whitespace-nowrap">{it.item_code}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <button type="button" onClick={() => setOpen(isOpen ? null : key)}
                          className="min-w-[2.5rem] px-2 py-1 rounded-md border border-brand-teal text-brand-teal font-bold whitespace-nowrap active:scale-95">
                          {it.n_lot} {isOpen ? '▴' : '▾'}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold">{fmtKg(it.kg)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-brand-navy">
                        {it.ea !== null ? fmtEa(it.ea) : <span className="text-amber-700 text-xs font-semibold">chưa có trọng lượng 1 EA</span>}
                        {it.g_ea !== null && <div className="text-[10px] text-brand-navy-soft font-normal">{it.g_ea} g/EA</div>}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-sky-50">
                        <td colSpan={4} className="px-3 pb-3 pt-0">
                          <table className="w-full text-sm bg-white rounded-md border border-sky-200">
                            <thead>
                              <tr className="text-xs text-brand-navy-soft">
                                <th className="px-2 py-1.5 text-left">LOT NO</th>
                                <th className="px-2 py-1.5 text-right">Trọng lượng (Kg)</th>
                                <th className="px-2 py-1.5 text-right">Số lượng (EA)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-sky-100">
                              {(it.lots ?? []).map((l, i) => (
                                <tr key={i}>
                                  <td className="px-2 py-1.5 tabular-nums">{l.lot}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtKg(l.kg)}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{l.ea !== null ? fmtEa(l.ea) : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                  <tr className="bg-slate-100 font-bold text-brand-navy">
                    <td className="px-3 py-2">Tổng</td>
                    <td className="px-2 py-2 text-right tabular-nums">{b.n_lot}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtKg(b.total_kg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtEa(b.total_ea)}
                      {b.n_no_g > 0 && <div className="text-[10px] text-amber-700 font-semibold">chưa tính {b.n_no_g} mã thiếu trọng lượng</div>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
