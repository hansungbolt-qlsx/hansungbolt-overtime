'use client';

import { useEffect, useRef, useState } from 'react';
import { toTitleCase } from '@/lib/format';

type Machine = { code: string; isOther: boolean; otherText?: string };
type EmpRow = {
  employee_id: string;
  employee_name: string;
  order_no: number;
  machines: Machine[];
};
type Summary = {
  date: string;
  restrictDept?: 'HD' | 'RL' | null;
  departments: { HD: EmpRow[]; RL: EmpRow[] };
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMachinesDetailed(machines: Machine[]): string {
  const codes: string[] = [];
  const others: string[] = [];
  for (const m of machines) {
    if (m.isOther) {
      others.push(m.otherText ? `Công việc khác: ${m.otherText}` : 'Công việc khác');
    } else {
      codes.push(m.code);
    }
  }
  return [...codes, ...others].join(', ');
}

export default function TodayOvertimeCard({
  initialDate,
  hideDatePicker = false,
}: {
  initialDate?: string;
  hideDatePicker?: boolean;
}) {
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shareRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/registrations/today-summary?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setData(d.error ? null : d);
      })
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const restrictDept = data?.restrictDept ?? null;
  const showHD = !restrictDept || restrictDept === 'HD';
  const showRL = !restrictDept || restrictDept === 'RL';
  const hd = data?.departments.HD ?? [];
  const rl = data?.departments.RL ?? [];
  const hdMachines = hd.reduce((s, e) => s + e.machines.length, 0);
  const rlMachines = rl.reduce((s, e) => s + e.machines.length, 0);
  const hasData = hd.length > 0 || rl.length > 0;

  const [yy, mm, dd] = date.split('-');
  const dateLabel = `${dd}/${mm}/${yy}`;

  async function handleShare() {
    if (!hasData || !shareRef.current || sharing) return;
    setSharing(true);
    try {
      const filename = `tang-ca-${date}.png`;
      const title = `Tăng ca hôm nay ${dateLabel}`;

      // Dynamic import — lib ~10KB gzipped, chỉ tải khi user tap Chia sẻ
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(shareRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        filter: (node) => {
          if (node instanceof HTMLElement && node.dataset.noShareCapture === 'true') {
            return false;
          }
          return true;
        },
      });

      if (!blob) {
        alert('Không tạo được ảnh để chia sẻ.');
        return;
      }

      const file = new File([blob], filename, { type: 'image/png' });

      // Web Share API Level 2 (file share) — iOS 15+, Android Chrome 75+
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ title, files: [file] });
          return;
        } catch (e) {
          const err = e as { name?: string };
          if (err?.name === 'AbortError') return;
        }
      }

      // Fallback: tải ảnh xuống máy, user mở Zalo gửi thủ công
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Đã tải ảnh xuống máy. Mở Zalo, gửi ảnh vào nhóm là xong.');
    } catch (e) {
      console.error('Share error:', e);
      alert('Lỗi khi tạo ảnh. Vui lòng thử lại.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <section
      ref={shareRef}
      className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-brand-surface-alt flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Tăng ca hôm nay</h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Ngày {dateLabel}
          </p>
        </div>
        {/* Vùng buttons — loại khỏi ảnh chia sẻ */}
        <div data-no-share-capture="true" className="flex items-center gap-2">
          {!hideDatePicker && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
          )}
          {hasData && (
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-teal hover:bg-brand-teal-dark active:scale-95 disabled:opacity-60 disabled:cursor-wait text-white text-sm font-semibold shadow-sm transition"
            >
              {sharing ? <SpinnerIcon /> : <ShareIcon />}
              {sharing ? 'Đang tạo ảnh...' : 'Chia sẻ'}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <p className="p-5 text-sm text-brand-navy-soft text-center">Đang tải...</p>
      )}

      {!loading && hd.length === 0 && rl.length === 0 && (
        <p className="p-5 text-sm text-brand-navy-soft text-center">
          Chưa có phiếu nào cho ngày này.
        </p>
      )}

      {!loading && (hd.length > 0 || rl.length > 0) && (
        <div className="divide-y divide-brand-surface-alt">
          {showHD && (
            <DeptSection
              title="HD"
              accent="#063882"
              employees={hd}
              totalMachines={hdMachines}
            />
          )}
          {showRL && (
            <DeptSection
              title="RL"
              accent="#2db5a1"
              employees={rl}
              totalMachines={rlMachines}
            />
          )}
        </div>
      )}
    </section>
  );
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function DeptSection({
  title,
  accent,
  employees,
  totalMachines,
}: {
  title: string;
  accent: string;
  employees: EmpRow[];
  totalMachines: number;
}) {
  if (employees.length === 0) {
    return (
      <div className="p-4 flex items-center gap-3">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-md text-white"
          style={{ backgroundColor: accent }}
        >
          {title}
        </span>
        <span className="text-sm text-brand-navy-soft italic">Chưa có ai</span>
      </div>
    );
  }
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-md text-white"
          style={{ backgroundColor: accent }}
        >
          {title}
        </span>
        <span className="text-sm font-semibold text-brand-navy">
          {employees.length} người
        </span>
        <span className="text-xs text-brand-navy-soft">• {totalMachines} máy</span>
      </div>
      <ol className="space-y-2.5">
        {employees.map((emp, idx) => (
          <li key={emp.employee_id} className="text-sm leading-snug">
            <div className="flex items-baseline gap-1.5">
              <span className="text-brand-navy-soft tabular-nums flex-shrink-0">
                {idx + 1}.
              </span>
              <span className="font-bold text-brand-navy">
                {toTitleCase(emp.employee_name)}
              </span>
            </div>
            <div className="ml-5 text-brand-navy break-words">
              {formatMachinesDetailed(emp.machines)}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
