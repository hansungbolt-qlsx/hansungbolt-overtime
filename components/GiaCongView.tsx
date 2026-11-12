'use client';

// GIA CÔNG 70/80 trên điện thoại — CHỈ tài khoản qlsx (anh Hữu chốt 14/10/2026).
// Phiếu ĐẶT: chọn công đoạn + nhà gia công → quét phiếu di chuyển (số chỉ thị) → gõ kg (số nguyên) → Lưu / Gửi.
// Phiếu NHẬP: quét phiếu di chuyển → tích thùng đang chờ về → kg về (mặc định = kg còn chờ) → Hoàn thành mặc định 1
// (giao thiếu còn nợ thì đổi 0 — để 1 khi về thiếu, app hỏi lại vì phần thiếu sẽ bị đóng).
// Gửi → agent → app chính: anh Hữu duyệt rồi Đẩy lên ERP. App này KHÔNG ghi ERP.

import { useCallback, useEffect, useMemo, useState } from 'react';
import BarcodeScanButton from './BarcodeScanButton';
import {
  GC_CD_DAT, GC_CD_EA, GC_CD_NHAP, GC_CONG_DOAN, GC_LOAI, GC_STATUS_UI, hienSaeji, kiemDong, normalizeSaeji,
  type GcCongDoan, type GcGuong, type GcLine, type GcLoai, type GcSlip,
} from '@/lib/gia-cong';

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const ngayGio = (s: string | null) => (s ? new Date(s).toLocaleString('vi-VN', { hour12: false }) : '');

export default function GiaCongView({ onChuaLuu }: { onChuaLuu?: (canhBao: string) => void }) {
  const [loai, setLoai] = useState<GcLoai>('dat');
  const [guong, setGuong] = useState<GcGuong | null>(null);
  const [slips, setSlips] = useState<GcSlip[]>([]);
  const [giuCho, setGiuCho] = useState<Record<string, string>>({});
  const [cd, setCd] = useState<GcCongDoan>('80');
  const [ncc, setNcc] = useState('');
  const [lines, setLines] = useState<GcLine[]>([]);
  const [note, setNote] = useState('');
  const [uid, setUid] = useState<string | undefined>(undefined);
  const [nhapTay, setNhapTay] = useState('');
  const [chonThung, setChonThung] = useState<string>('');   // số chỉ thị vừa quét (phiếu nhập) → hiện thùng chờ về
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const taiPhieu = useCallback(async (l: GcLoai) => {
    const r = await fetch(`/api/gc-slips?loai=${l}`);
    const j = await r.json();
    if (r.ok) { setSlips(j.slips || []); setGiuCho(j.giu_cho || {}); }
  }, []);
  useEffect(() => {
    let song = true;
    fetch('/api/gc-guong').then((r) => r.json()).then((j) => { if (song) setGuong(j); }).catch(() => {});
    return () => { song = false; };
  }, []);
  useEffect(() => {
    let song = true;
    fetch(`/api/gc-slips?loai=${loai}`).then(async (r) => ({ ok: r.ok, j: await r.json() })).then(({ ok, j }) => {
      if (song && ok) { setSlips(j.slips || []); setGiuCho(j.giu_cho || {}); }
    }).catch(() => {});
    return () => { song = false; };
  }, [loai]);

  const nccCuaCd = useMemo(() => (guong?.ncc || []).filter((n) => n.cong_doan === cd), [guong, cd]);
  // NCC đang chọn không thuộc công đoạn này (vừa đổi công đoạn) → lấy NCC đầu danh sách
  const nccChon = nccCuaCd.some((n) => n.ma === ncc) ? ncc : (nccCuaCd[0]?.ma ?? '');

  const canhBao = lines.length ? `Phiếu ${loai === 'dat' ? 'đặt' : 'nhập'} gia công còn ${lines.length} dòng chưa Lưu / Gửi` : '';
  useEffect(() => { onChuaLuu?.(canhBao); return () => onChuaLuu?.(''); }, [canhBao, onChuaLuu]);

  const lamMoi = () => { setLines([]); setNote(''); setUid(undefined); setChonThung(''); setMsg(null); };
  const doiLoai = (l: GcLoai) => {
    if (lines.length && !window.confirm('Bỏ các dòng chưa lưu để chuyển loại phiếu?')) return;
    lamMoi(); setLoai(l);
    if (l === 'nhap' && !GC_CD_NHAP.includes(cd)) setCd('80');
  };

  const quet = (text: string) => {
    const sj = normalizeSaeji(text);
    if (sj.length < 9) { setMsg({ ok: false, text: `Mã quét không phải số chỉ thị: ${text}` }); return; }
    setMsg(null);
    if (loai === 'dat') {
      const g = guong?.cho_dat.find((x) => x.saeji_no === sj && x.cong_doan === cd);
      if (!g) {
        setMsg({ ok: false, text: `Chỉ thị ${hienSaeji(sj)} không có trong danh sách chờ đặt công đoạn ${cd} (đã hoàn thành / sai công đoạn)` });
        return;
      }
      if (g.vao <= 0) setMsg({ ok: false, text: `Chỉ thị ${hienSaeji(sj)} chưa có lượng vào công đoạn — vẫn lưu được, nhưng app chính chỉ đẩy ERP sau khi nhập khống 1 EA` });
      setLines((ls) => [...ls, { saeji_no: sj, ma_hang: g.ma_hang, ten_hang: g.ten_hang, kg: 0 }]);
    } else {
      setChonThung(sj);
    }
  };

  const thungCho = useMemo(() => (guong?.cho_ve || []).filter((t) =>
    t.saeji_no === chonThung && t.cong_doan === cd && t.ncc === nccChon), [guong, chonThung, cd, nccChon]);
  const daChon = (k: string) => lines.some((l) => `${l.dat_no}-${l.dat_seq}` === k);
  const tichThung = (t: GcGuong['cho_ve'][number]) => {
    const k = `${t.dat_no}-${t.dat_seq}`;
    if (daChon(k)) { setLines((ls) => ls.filter((l) => `${l.dat_no}-${l.dat_seq}` !== k)); return; }
    const eaCon = (t.ea_dat ?? 0) - (t.ea_da_ve ?? 0);
    setLines((ls) => [...ls, { saeji_no: t.saeji_no, ma_hang: t.ma_hang, ten_hang: t.ten_hang, kg: Math.max(0, t.kg_dat - t.kg_da_ve),
      dat_no: t.dat_no, dat_seq: t.dat_seq, kg_dat: t.kg_dat, kg_da_ve: t.kg_da_ve, hoan_thanh: 1,
      ...(theoEa ? { ea: eaCon, ea_dat: t.ea_dat, ea_da_ve: t.ea_da_ve, don_trong: t.don_trong } : {}) }]);
  };

  // Công đoạn tính EA (15/20 — ERP gjcode.Gjgubun = 1): gõ EA thực về, kg tự tính theo đơn trọng (sửa được)
  const theoEa = loai === 'nhap' && GC_CD_EA.includes(cd);
  const kgTuEa = (ea: number, dt?: number) => (dt ? Math.round((ea * dt) / 1000) : 0);
  const suaDong =(i: number, p: Partial<GcLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const xoaDong = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));

  const luu = async (send: boolean) => {
    const loi = kiemDong(loai, lines, cd) || (nccChon ? '' : 'Chưa có nhà gia công cho công đoạn này');
    if (loi) { setMsg({ ok: false, text: loi }); return; }
    if (send && loai === 'nhap') {
      const ve = (l: GcLine) => (theoEa ? l.ea ?? 0 : l.kg);
      const con = (l: GcLine) => (theoEa ? (l.ea_dat ?? 0) - (l.ea_da_ve ?? 0) : (l.kg_dat ?? 0) - (l.kg_da_ve ?? 0));
      const dv = theoEa ? 'EA' : 'kg';
      const thieu = lines.filter((l) => l.hoan_thanh === 1 && ve(l) < con(l));
      if (thieu.length && !window.confirm(
        thieu.map((l) => `Chỉ thị ${hienSaeji(l.saeji_no)}: về ${fmt(ve(l))} ${dv} < còn chờ ${fmt(con(l))} ${dv}`).join('\n')
        + '\n\nĐang để Hoàn thành = 1 → CHỐT, phần thiếu tính hao hụt, không chờ về nữa.\nVẫn gửi? (Bấm Hủy để chọn 0 = còn Pending)')) return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/gc-slips', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, loai, cong_doan: cd, ncc: nccChon, lines, note, send }) });
      const j = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: j.error || 'Lưu lỗi' }); return; }
      setMsg({ ok: true, text: send ? 'Đã gửi — chờ anh Hữu duyệt trên app chính' : 'Đã lưu nháp' });
      if (send) { setLines([]); setNote(''); setUid(undefined); setChonThung(''); } else setUid(j.uid);
      await taiPhieu(loai);
    } finally { setBusy(false); }
  };

  const moPhieu = (s: GcSlip) => {
    if (lines.length && !window.confirm('Bỏ các dòng chưa lưu để mở phiếu khác?')) return;
    setCd(s.cong_doan); setNcc(s.ncc); setNote(s.note || ''); setChonThung('');
    if (s.status === 'draft' || s.status === 'rejected') { setUid(s.uid); setLines(s.lines); setMsg(null); }
    else { setUid(undefined); setLines([]); setMsg({ ok: true, text: `Phiếu ${s.uid} — ${GC_STATUS_UI[s.status].label}` }); }
  };
  const xoaNhap = async (s: GcSlip) => {
    if (!window.confirm('Xoá phiếu nháp này?')) return;
    await fetch(`/api/gc-slips?uid=${encodeURIComponent(s.uid)}`, { method: 'DELETE' });
    if (uid === s.uid) lamMoi();
    await taiPhieu(loai);
  };

  const tongKg = lines.reduce((a, l) => a + (Number.isInteger(l.kg) ? l.kg : 0), 0);
  const o = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-base';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(['dat', 'nhap'] as GcLoai[]).map((l) => (
          <button key={l} type="button" onClick={() => doiLoai(l)}
            className={`py-2.5 rounded-xl text-sm font-semibold border ${loai === l ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-brand-navy border-brand-navy/30'}`}>
            {l === 'dat' ? '📦 Đặt gia công' : '📥 Nhập gia công'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
        <div className="text-base font-bold text-brand-navy">{GC_LOAI[loai]}{uid ? ` · ${uid}` : ''}</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold text-slate-600">Công đoạn
            <select className={o} value={cd} disabled={lines.length > 0}
              onChange={(e) => { setCd(e.target.value as GcCongDoan); setChonThung(''); }}>
              {(loai === 'nhap' ? GC_CD_NHAP : GC_CD_DAT).map((k) => <option key={k} value={k}>{GC_CONG_DOAN[k]}</option>)}
            </select></label>
          <label className="text-sm font-semibold text-slate-600">Nhà gia công
            <select className={o} value={nccChon} disabled={lines.length > 0} onChange={(e) => { setNcc(e.target.value); setChonThung(''); }}>
              {nccCuaCd.map((n) => <option key={n.ma} value={n.ma}>{n.ma} — {n.ten}</option>)}
            </select></label>
        </div>
        {lines.length > 0 && <div className="text-xs text-slate-500">Đã có dòng → khoá công đoạn + nhà gia công (1 phiếu = 1 công đoạn + 1 nhà gia công).</div>}
        <BarcodeScanButton label="📷 Quét phiếu di chuyển" onScan={(t) => quet(t)} />
        <div className="flex gap-2 items-center">
          <input className={`${o} flex-1 min-w-0`} inputMode="numeric" placeholder="hoặc gõ số chỉ thị" value={nhapTay}
            onChange={(e) => setNhapTay(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nhapTay) { quet(nhapTay); setNhapTay(''); } }} />
          <button type="button" className="shrink-0 rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold"
            onClick={() => { if (nhapTay) { quet(nhapTay); setNhapTay(''); } }}>Thêm</button>
        </div>
        {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

        {loai === 'nhap' && chonThung && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
            <div className="text-sm font-semibold text-amber-900 mb-1">Thùng chờ về của chỉ thị {hienSaeji(chonThung)} · {nccChon} · CĐ {cd}</div>
            {!thungCho.length && <div className="text-sm text-red-700">Không có thùng nào đang chờ về (đã về đủ / sai nhà gia công / sai công đoạn).</div>}
            {thungCho.map((t) => {
              const k = `${t.dat_no}-${t.dat_seq}`;
              const giu = giuCho[k] && giuCho[k] !== uid;
              return (
                <label key={k} className={`flex items-center gap-2 py-1 text-sm ${giu ? 'opacity-50' : ''}`}>
                  <input type="checkbox" className="h-5 w-5" disabled={!!giu} checked={daChon(k)} onChange={() => tichThung(t)} />
                  <span className="font-mono">{t.dat_no.slice(0, 6)}-{t.dat_no.slice(6)}-{t.dat_seq}</span>
                  {theoEa
                    ? <span>đặt {fmt(t.ea_dat ?? 0)} EA{t.ea_da_ve ? ` · đã về ${fmt(t.ea_da_ve)}` : ''}</span>
                    : <span>đặt {fmt(t.kg_dat)} kg{t.kg_da_ve ? ` · đã về ${fmt(t.kg_da_ve)}` : ''}</span>}
                  {giu && <span className="text-red-700">(đang ở phiếu khác)</span>}
                </label>
              );
            })}
          </div>
        )}

        {lines.length > 0 && (
          <div className="space-y-2">
            {lines.map((l, i) => {
              const dv = theoEa ? 'EA' : 'kg';
              const con = theoEa ? (l.ea_dat ?? 0) - (l.ea_da_ve ?? 0) : (l.kg_dat ?? 0) - (l.kg_da_ve ?? 0);
              const ve = theoEa ? l.ea ?? 0 : l.kg;
              const chenh = loai === 'nhap' && Number.isInteger(ve) && ve > 0 && ve !== con;
              return (
                <div key={i} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex justify-between text-sm">
                    <b className="text-brand-navy">{i + 1}. {hienSaeji(l.saeji_no)} · {l.ma_hang}</b>
                    <button type="button" className="text-red-600 text-sm" onClick={() => xoaDong(i)}>Xoá</button>
                  </div>
                  <div className="text-xs text-slate-500">{l.ten_hang}{l.dat_no ? ` · thùng ${l.dat_no}-${l.dat_seq} · còn chờ ${fmt(con)} ${dv}` : ''}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {theoEa && (
                      <label className="text-sm font-semibold">EA
                        <input className="ml-1 w-32 rounded-lg border-2 border-amber-400 px-2 py-1.5 text-lg font-bold" inputMode="numeric"
                          value={l.ea || ''} onChange={(e) => {
                            const ea = Number(e.target.value.replace(/[^0-9]/g, ''));
                            suaDong(i, { ea, kg: kgTuEa(ea, l.don_trong) });
                          }} /></label>
                    )}
                    <label className="text-sm font-semibold">Kg
                      <input className={`ml-1 w-28 rounded-lg px-2 py-1.5 text-lg font-bold ${theoEa ? 'border border-slate-300' : 'border-2 border-amber-400'}`} inputMode="numeric"
                        value={l.kg || ''} onChange={(e) => suaDong(i, { kg: Number(e.target.value.replace(/[^0-9]/g, '')) })} /></label>
                    {loai === 'nhap' && (
                      <label className="text-sm font-semibold">Hoàn thành
                        <select className="ml-1 rounded-lg border px-2 py-1.5" value={l.hoan_thanh ?? 1}
                          onChange={(e) => suaDong(i, { hoan_thanh: Number(e.target.value) as 0 | 1 })}>
                          <option value={1}>1 — chốt</option><option value={0}>0 — còn Pending</option>
                        </select></label>
                    )}
                  </div>
                  {chenh && ve < con && <div className="mt-1 text-xs font-semibold text-red-700">
                    {l.hoan_thanh === 1 ? `⚠ Về thiếu ${fmt(con - ve)} ${dv}, Hoàn thành 1 → CHỐT, phần thiếu tính hao hụt. Còn chờ về thì chọn 0.`
                      : `Về thiếu ${fmt(con - ve)} ${dv}, Hoàn thành 0 → thùng còn PENDING ${fmt(con - ve)} ${dv} chờ về.`}</div>}
                  {chenh && ve > con && <div className="mt-1 text-xs font-semibold text-amber-700">Về dư {fmt(ve - con)} {dv} so với còn chờ.</div>}
                </div>
              );
            })}
            <div className="text-sm text-slate-600">Tổng: <b>{lines.length}</b> dòng · <b>{fmt(tongKg)}</b> kg</div>
            <input className={o} placeholder="Ghi chú (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => void luu(false)} className="rounded-xl border border-brand-navy py-2.5 font-semibold text-brand-navy">💾 Lưu nháp</button>
              <button type="button" disabled={busy} onClick={() => void luu(true)} className="rounded-xl bg-brand-navy py-2.5 font-semibold text-white">📤 Gửi</button>
            </div>
          </div>
        )}
        {!guong?.cho_dat?.length && <div className="text-sm text-amber-700">{guong?.at ? '' : 'Chưa có danh sách chỉ thị (máy chủ chưa đẩy) — thử lại sau ít phút.'}</div>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-base font-bold text-brand-navy mb-2">Phiếu đã lập (30 ngày)</div>
        {!slips.length && <div className="text-sm text-slate-500">Chưa có phiếu.</div>}
        {slips.map((s) => (
          <div key={s.uid} className="border-t border-slate-100 py-2 text-sm">
            <div className="flex justify-between items-center gap-2">
              <button type="button" className="text-left" onClick={() => moPhieu(s)}>
                <b>{s.ncc} · CĐ {s.cong_doan}</b> · {s.lines.length} dòng · {fmt(s.lines.reduce((a, l) => a + (l.kg || 0), 0))} kg
                <div className="text-xs text-slate-500">{ngayGio(s.sent_at || s.created_at)}{s.erp_ref ? ` · ERP ${s.erp_ref}` : ''}</div>
              </button>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${GC_STATUS_UI[s.status].cls}`}>{GC_STATUS_UI[s.status].label}</span>
            </div>
            {s.reject_reason && <div className="text-xs text-red-700 mt-1">Lý do: {s.reject_reason}</div>}
            {s.status === 'pushed' && s.last_error && (
              <div className={`text-xs mt-1 break-words ${s.last_error.startsWith('⚠') ? 'font-semibold text-red-700' : 'text-slate-500'}`}>{s.last_error}</div>
            )}
            {s.status === 'draft' && <button type="button" className="text-xs text-red-600 mt-1" onClick={() => void xoaNhap(s)}>Xoá nháp</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
