'use client';

import { useEffect, useMemo, useState } from 'react';
import PrintJobButton from './PrintJobButton';

type SheetData = {
  rows: (string | null)[][];
  merges: { r: number; c: number; rs: number; cs: number }[];
  nCols: number;
  machineCol: number;
  itemCol: number;
  cttCol: number;
  statusCol: number;
};

type KhsxData = {
  fileId: string;
  planDate: string;
  fileName: string;
  uploadedAt: string;
  tong: SheetData | null;
  homnay: SheetData | null;
};

type SubTab = 'homnay' | 'tong';

// Trạng thái hiện chữ đỏ (đồng bộ danh sách _RED_STATUS app chính)
const RED_STATUS = ['hết nvl', 'hư máy', 'máy hư', 'hết kế hoạch', 'chờ sales'];

function isRedStatus(v: string | null): boolean {
  if (!v) return false;
  const s = v.toLowerCase();
  return RED_STATUS.some((k) => s.includes(k));
}

// Bảng KHSX render từ dữ liệu sheet: header xanh, ô Máy cam gộp, số âm (…) đỏ,
// dòng đầu mỗi nhóm máy = đang chạy (đậm + nền xám nhạt).
function SheetTable({
  sheet,
  onItemClick,
}: {
  sheet: SheetData;
  onItemClick?: (info: { saeji: string; item: string; machine: string }) => void;
}) {
  // Ô bị merge che → skip; ô gốc merge → rowSpan/colSpan
  const { covered, mergeAt } = useMemo(() => {
    const covered = new Set<string>();
    const mergeAt = new Map<string, { rs: number; cs: number }>();
    for (const m of sheet.merges) {
      mergeAt.set(`${m.r}:${m.c}`, { rs: m.rs, cs: m.cs });
      for (let r = m.r; r < m.r + m.rs; r++) {
        for (let c = m.c; c < m.c + m.cs; c++) {
          if (r !== m.r || c !== m.c) covered.add(`${r}:${c}`);
        }
      }
    }
    return { covered, mergeAt };
  }, [sheet]);

  // Dòng đầu nhóm máy (anchor merge cột Máy có giá trị) + máy dừng (status đỏ)
  const machineAnchors = useMemo(() => {
    const anchors = new Map<number, { span: number; stopped: boolean }>();
    if (sheet.machineCol < 0) return anchors;
    for (let r = 1; r < sheet.rows.length; r++) {
      const key = `${r}:${sheet.machineCol}`;
      const mc = sheet.rows[r]?.[sheet.machineCol];
      if (covered.has(key) || mc == null) continue;
      const span = mergeAt.get(key)?.rs ?? 1;
      const st = sheet.statusCol >= 0 ? sheet.rows[r]?.[sheet.statusCol] : null;
      anchors.set(r, { span, stopped: isRedStatus(st ?? null) });
    }
    return anchors;
  }, [sheet, covered, mergeAt]);

  return (
    <div className="overflow-x-auto rounded-lg border border-brand-surface-alt bg-white">
      <table className="border-collapse text-[11px] leading-tight whitespace-nowrap">
        <tbody>
          {sheet.rows.map((row, r) => {
            const anchor = machineAnchors.get(r);
            const isRun = anchor != null && !anchor.stopped && row[sheet.itemCol] != null;
            return (
              <tr key={r} className={r === 0 ? 'bg-[#dce8fa] font-bold text-[#063882]' : ''}>
                {row.map((v, c) => {
                  const key = `${r}:${c}`;
                  if (covered.has(key)) return null;
                  const m = mergeAt.get(key);
                  const isMachine = c === sheet.machineCol && r > 0;
                  const neg = v != null && v.startsWith('(') && v.endsWith(')');
                  const redSt = c === sheet.statusCol && isRedStatus(v);
                  const clickable =
                    onItemClick != null && c === sheet.itemCol && r > 0 && v != null;
                  let cls =
                    'border border-slate-300 px-1.5 py-0.5 text-center tabular-nums align-middle';
                  if (isMachine) {
                    cls += ' bg-[#fee2bf] font-extrabold';
                    cls += anchor?.stopped ? ' text-rose-600' : ' text-[#063882]';
                  } else if (r > 0 && isRun) {
                    cls += ' bg-[#eef1f5] font-semibold';
                  }
                  if (neg || redSt) cls += ' text-red-600 font-semibold';
                  if (clickable)
                    cls +=
                      ' text-[#063882] underline decoration-dotted underline-offset-2 cursor-pointer hover:bg-sky-100 font-semibold';
                  return (
                    <td
                      key={c}
                      rowSpan={m?.rs}
                      colSpan={m?.cs}
                      className={cls}
                      onClick={
                        clickable
                          ? () => {
                              // Máy = ô anchor của nhóm chứa dòng này
                              let machine = '';
                              for (const [ar, info] of machineAnchors) {
                                if (r >= ar && r < ar + info.span) {
                                  machine = sheet.rows[ar]?.[sheet.machineCol] ?? '';
                                  break;
                                }
                              }
                              onItemClick({
                                saeji: (row[sheet.cttCol] ?? '').replace(/\D/g, ''),
                                item: v ?? '',
                                machine,
                              });
                            }
                          : undefined
                      }
                    >
                      {v ?? ' '}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Công đoạn in được phiếu DCCD lẻ theo bộ phận (khớp phân quyền API print-jobs)
const DCCD_GJ: Record<string, [string, string][]> = {
  HD: [['10', 'CĐ 10 — H/D']],
  RL: [
    ['30', 'CĐ 30 — R/L'],
    ['45', 'CĐ 45 — S/R'],
    ['60', 'CĐ 60 — C/T'],
  ],
};
const DCCD_GJ_ALL: [string, string][] = [...DCCD_GJ.HD, ...DCCD_GJ.RL];

// Card In phiếu DCCD LẺ (user 13/7): tổ trưởng gõ số chỉ thị + chọn công đoạn
// của bộ phận mình → agent ủy quyền app chính in. Máy/khay app chính tự xử lý.
function DccdManualCard({ options }: { options: [string, string][] }) {
  const [saeji, setSaeji] = useState('');
  const [gj, setGj] = useState(options[0][0]);
  const [copies, setCopies] = useState('1');
  const digits = saeji.replace(/\D/g, '');
  const valid = digits.length >= 6 && digits.length <= 9;

  return (
    <div className="bg-white rounded-lg border border-brand-surface-alt p-3 mb-3">
      <div className="text-sm font-bold text-brand-navy mb-2">🖨 In phiếu DCCD lẻ</div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] text-brand-navy-soft mb-0.5">
            Số chỉ thị (vd 606-169)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={saeji}
            onChange={(e) => setSaeji(e.target.value)}
            placeholder="606-169"
            className="w-32 px-2 py-1.5 border border-gray-300 rounded-md text-sm font-mono text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </div>
        <div>
          <label className="block text-[11px] text-brand-navy-soft mb-0.5">Công đoạn</label>
          <select
            value={gj}
            onChange={(e) => setGj(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm text-brand-navy"
          >
            {options.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-brand-navy-soft mb-0.5">Số liên</label>
          <select
            value={copies}
            onChange={(e) => setCopies(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm text-brand-navy"
          >
            {['1', '2', '3'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {valid ? (
          <PrintJobButton type="dccd" refId={`${digits}|${gj}|${copies}`} label="In phiếu" />
        ) : (
          <span className="text-[11px] text-brand-navy-soft pb-1.5">
            ← nhập đủ số chỉ thị để in
          </span>
        )}
      </div>
    </div>
  );
}

export default function PlanView({
  department,
  isLeader,
  isAdmin = false,
}: {
  department: string;
  isLeader: boolean;
  isAdmin?: boolean;
}) {
  const [data, setData] = useState<KhsxData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SubTab>('homnay');
  const [dccd, setDccd] = useState<{ saeji: string; item: string; machine: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/khsx')
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (ok) setData(d);
        else setErr(d.error || 'Không tải được KHSX');
      })
      .catch(() => { if (!cancelled) setErr('Mạng lỗi — thử lại sau'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Click mã hàng in phiếu DCCD nhanh (CĐ 10): HD leader + admin
  const canDccd = isAdmin || (isLeader && department === 'HD');
  // In DCCD lẻ: theo công đoạn của bộ phận (HD→10; RL→30/45/60); admin đủ 4
  const dccdOptions = isAdmin
    ? DCCD_GJ_ALL
    : isLeader
      ? (DCCD_GJ[department] ?? [])
      : [];

  const sheet = data ? (tab === 'homnay' ? data.homnay : data.tong) : null;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-surface-alt flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Kế hoạch sản xuất</h2>
          {data && (
            <p className="text-xs text-brand-navy-soft mt-0.5">
              Ngày {data.planDate} — đồng bộ từ app chính lúc{' '}
              {new Date(data.uploadedAt).toLocaleString('vi-VN', {
                hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
              })}
            </p>
          )}
        </div>
        {data && sheet && (
          <PrintJobButton
            type={tab === 'homnay' ? 'khsx_homnay' : 'khsx_tong'}
            refId={data.fileId}
            label={tab === 'homnay' ? 'In KHSX hôm nay' : 'In KHSX tổng'}
          />
        )}
      </div>

      <div className="flex gap-2 px-4 pt-3">
        {(
          [
            ['homnay', 'KHSX hôm nay'],
            ['tong', 'KHSX tổng'],
          ] as [SubTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-t-xl text-sm font-bold transition ${
              tab === k
                ? 'bg-[#063882] text-white shadow'
                : 'bg-[#dce8fa] text-[#063882] hover:bg-[#c4d8f5]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3 bg-[#f0f5ff] min-h-[120px]">
        {dccdOptions.length > 0 && <DccdManualCard options={dccdOptions} />}
        {loading && <p className="text-sm text-brand-navy-soft text-center py-6">Đang tải...</p>}
        {err && <p className="text-sm text-red-600 text-center py-6">{err}</p>}
        {!loading && !err && sheet == null && (
          <p className="text-sm text-brand-navy-soft text-center py-6">
            File hiện tại chưa có sheet này.
          </p>
        )}
        {sheet && (
          <>
            {tab === 'homnay' && canDccd && (
              <p className="text-[11px] text-brand-navy-soft mb-2">
                💡 Bấm vào <span className="underline decoration-dotted">Item code</span> để in
                phiếu DCCD công đoạn 10 của chỉ thị đó.
              </p>
            )}
            <SheetTable
              sheet={sheet}
              onItemClick={tab === 'homnay' && canDccd ? setDccd : undefined}
            />
          </>
        )}
      </div>

      {/* Modal in phiếu DCCD */}
      {dccd && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDccd(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-brand-navy text-base mb-3">
              🖨 In phiếu DCCD — công đoạn 10
            </h3>
            <div className="text-sm text-brand-navy space-y-1.5 mb-4">
              <div><span className="text-brand-navy-soft">Item code:</span>{' '}
                <b className="font-mono">{dccd.item}</b></div>
              <div><span className="text-brand-navy-soft">Số chỉ thị:</span>{' '}
                <b className="font-mono">{dccd.saeji}</b></div>
              <div><span className="text-brand-navy-soft">Máy:</span> <b>{dccd.machine || '—'}</b></div>
              <p className="text-[11px] text-brand-navy-soft">
                Máy in văn phòng · khay giấy do app chính tự chọn theo quy định
              </p>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDccd(null)}
                className="text-sm px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-brand-navy font-semibold"
              >
                Đóng
              </button>
              <PrintJobButton type="dccd" refId={`${dccd.saeji}|10|1`} label="In phiếu DCCD" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
