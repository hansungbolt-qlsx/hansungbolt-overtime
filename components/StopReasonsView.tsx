'use client';

// Máy dừng hôm nay (user chốt 19/7): tổ trưởng cuối ngày ghi lý do cho các máy
// CẢ NGÀY không sản xuất — 1 lý do / máy / ngày. App chính poll về điền TV Kết
// quả ngày (người tổng hợp TV vẫn là người chốt cuối, sửa đè được).
import { useCallback, useEffect, useState } from 'react';

// Nhãn kèm VIẾT TẮT đồng bộ chip TV (user 20/7) + lý do ST Setting mới
const REASONS: Array<{ code: string; label: string }> = [
  { code: 'NW', label: 'Không có người (NW)' },
  { code: 'NM', label: 'Không có khuôn (NM)' },
  { code: 'NP', label: 'Không có kế hoạch (NP)' },
  { code: 'NR', label: 'Không có nguyên liệu (NR)' },
  { code: 'MT', label: 'Hư máy / bảo trì (MT)' },
  { code: 'ST', label: 'Setting (ST)' },
  { code: 'ETC', label: 'Khác — ghi rõ (Etc)' },
];
const LABEL: Record<string, string> = Object.fromEntries(
  REASONS.map((r) => [r.code, r.label]),
);

type StopReason = {
  machine_code: string;
  reason_code: string;
  reason_text: string | null;
  created_by_name: string | null;
  updated_at?: string;
};

function fmtTimeVN(iso?: string): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function todayISO() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// Thứ tự máy GIỐNG file TV (user 20/7): theo số tăng dần, biến thể chữ ngay sau
// số gốc (HD-01, HD-1A, HD-02… HD-9A, HD-9B, HD-10…); mã không theo mẫu
// (vd CVK-HD) xuống cuối.
const DEPT_RANK: Record<string, number> = { HD: 0, RL: 1, SM: 2, CT: 3 };

function machineSortKey(code: string): [number, number, number, string] {
  const m = code.match(/^([A-Z]+)-(\d+)([A-Z]?)$/i);
  if (!m) return [9, 0, 9999, code];
  const rank = DEPT_RANK[m[1].toUpperCase()] ?? 8;
  return [rank, 0, parseInt(m[2], 10), m[3] || ''];
}

function sortMachines(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const ka = machineSortKey(a);
    const kb = machineSortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[2] !== kb[2]) return (ka[2] as number) - (kb[2] as number);
    return ka[3] < kb[3] ? -1 : ka[3] > kb[3] ? 1 : 0;
  });
}

export default function StopReasonsView() {
  const [date, setDate] = useState(todayISO());
  const [machines, setMachines] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, StopReason>>({});
  const [editing, setEditing] = useState<string | null>(null); // máy đang mở panel chọn
  const [pickCode, setPickCode] = useState<string>('');
  const [etcText, setEtcText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/stop-reasons?date=${d}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi tải dữ liệu');
      setMachines(sortMachines((data.machines ?? []).map((m: { code: string }) => m.code)));
      const map: Record<string, StopReason> = {};
      for (const r of data.reasons ?? []) map[r.machine_code] = r;
      setSaved(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  // Chỉ ghi/sửa HÔM NAY + HÔM QUA (user chốt 20/7) — ngày khác là lịch sử chỉ xem
  const yesterdayISO = new Date(Date.now() + 7 * 3600 * 1000 - 86400 * 1000)
    .toISOString()
    .slice(0, 10);
  const canEdit = date === todayISO() || date === yesterdayISO;

  const openEdit = (machine: string) => {
    if (!canEdit) return;
    const cur = saved[machine];
    setEditing(machine);
    setPickCode(cur?.reason_code ?? '');
    setEtcText(cur?.reason_code === 'ETC' ? (cur.reason_text ?? '') : '');
  };

  const submit = async (machine: string, code: string | null) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/stop-reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          machine_code: machine,
          reason_code: code,
          reason_text: code === 'ETC' ? etcText.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không lưu được');
      setEditing(null);
      await load(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được');
    } finally {
      setBusy(false);
    }
  };

  const nSaved = Object.keys(saved).length;

  return (
    <div className="bg-white rounded-2xl shadow-md p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-base font-bold text-brand-navy">⏸ Máy dừng hôm nay</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
        />
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Chỉ ghi máy <b>cả ngày không sản xuất</b> — chọn máy rồi chọn lý do. Đã ghi:{' '}
        <b className="text-brand-navy">{nSaved}</b> máy.
      </p>
      {!canEdit && (
        <div className="mb-3 rounded-lg bg-slate-100 border border-slate-300 text-slate-600 text-xs px-3 py-2">
          📖 Đang xem <b>lịch sử</b> — chỉ được ghi/sửa máy dừng của <b>hôm nay</b> và{' '}
          <b>hôm qua</b>.
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-slate-400 py-6 text-center">Đang tải…</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {machines.map((m) => {
            const cur = saved[m];
            const isEditing = editing === m;
            return (
              <div key={m} className={isEditing ? 'col-span-3 sm:col-span-4' : ''}>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => openEdit(m)}
                    className={`w-full rounded-xl border px-2 py-2 text-left transition active:scale-95 ${
                      cur
                        ? 'bg-amber-50 border-amber-400'
                        : 'bg-white border-slate-200 hover:border-brand-teal'
                    }`}
                  >
                    <div className="text-sm font-bold text-brand-navy">{m}</div>
                    {cur ? (
                      <div className="text-[11px] leading-tight text-amber-700 font-semibold">
                        {LABEL[cur.reason_code] ?? cur.reason_code}
                        {cur.reason_code === 'ETC' && cur.reason_text ? `: ${cur.reason_text}` : ''}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">Đang chạy</div>
                    )}
                  </button>
                ) : (
                  <div className="rounded-xl border-2 border-brand-teal bg-brand-teal/5 p-3">
                    <div className="text-sm font-bold text-brand-navy mb-2">
                      {m} — lý do dừng cả ngày
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      {REASONS.map((r) => (
                        <button
                          key={r.code}
                          type="button"
                          onClick={() => setPickCode(r.code)}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold text-left ${
                            pickCode === r.code
                              ? 'bg-brand-navy text-white border-brand-navy'
                              : 'bg-white text-brand-navy border-slate-300'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    {pickCode === 'ETC' && (
                      <input
                        type="text"
                        value={etcText}
                        onChange={(e) => setEtcText(e.target.value)}
                        placeholder="Ghi rõ lý do cụ thể…"
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mb-2"
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || !pickCode || (pickCode === 'ETC' && !etcText.trim())}
                        onClick={() => void submit(m, pickCode)}
                        className="flex-1 rounded-lg bg-brand-teal text-white text-sm font-bold py-1.5 disabled:opacity-40"
                      >
                        {busy ? 'Đang lưu…' : 'Lưu'}
                      </button>
                      {saved[m] && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void submit(m, null)}
                          className="rounded-lg border border-red-300 text-red-600 text-sm font-bold px-3 py-1.5"
                        >
                          Máy có chạy — bỏ
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-lg border border-slate-300 text-slate-500 text-sm font-bold px-3 py-1.5"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Bảng ĐỐI CHIẾU (user 20/7): tổ trưởng rà lại 1 lượt trước khi rời tay */}
      {nSaved > 0 && (
        <div className="mt-4 rounded-xl border-2 border-brand-navy/20 overflow-hidden">
          <div className="bg-brand-navy/5 px-3 py-2 text-sm font-bold text-brand-navy">
            📋 Đối chiếu — {nSaved} máy dừng đã ghi
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-left">
                <th className="px-3 py-1.5 font-bold">Máy</th>
                <th className="px-3 py-1.5 font-bold">Lý do</th>
                <th className="px-3 py-1.5 font-bold whitespace-nowrap">Người ghi</th>
              </tr>
            </thead>
            <tbody>
              {sortMachines(Object.keys(saved)).map((mc) => {
                const r = saved[mc];
                const auto = r.created_by_name === 'KHSX tự động';
                return (
                  <tr key={mc} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-bold text-brand-navy whitespace-nowrap">{mc}</td>
                    <td className="px-3 py-1.5">
                      {LABEL[r.reason_code] ?? r.reason_code}
                      {r.reason_text ? (
                        <span className="text-slate-500"> — {r.reason_text}</span>
                      ) : null}
                    </td>
                    <td className={`px-3 py-1.5 whitespace-nowrap ${auto ? 'italic text-teal-700' : 'text-slate-500'}`}>
                      {auto ? '⚙ KHSX tự động' : r.created_by_name} {fmtTimeVN(r.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        Máy ngưng có nguyên nhân rõ trên KHSX (Hết NVL, Hết kế hoạch, Hư máy…) được{' '}
        <b>điền sẵn tự động</b> — tổ trưởng chỉ rà lại, sai thì bấm máy sửa hoặc “Máy có
        chạy — bỏ”. Lý do sẽ tự cập nhật vào Kết quả ngày trên app chính; người tổng hợp
        TV vẫn là bản chốt cuối.
      </p>
    </div>
  );
}
