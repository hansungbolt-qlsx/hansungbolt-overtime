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

const SHARE_FONT =
  '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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

  const shareViewRef = useRef<HTMLDivElement>(null);

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
    if (!hasData || !shareViewRef.current || sharing) return;
    setSharing(true);
    try {
      const filename = `tang-ca-${date}.png`;
      const title = `Tăng ca hôm nay ${dateLabel}`;

      // Đợi font load xong để render đúng
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready;
      }

      const { toBlob } = await import('html-to-image');
      const node = shareViewRef.current;
      const blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });

      if (!blob) {
        alert('Không tạo được ảnh để chia sẻ.');
        return;
      }

      const file = new File([blob], filename, { type: 'image/png' });

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

      // Fallback: tải xuống
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
    <>
      <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-surface-alt flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-navy">Tăng ca hôm nay</h2>
            <p className="text-xs text-brand-navy-soft mt-0.5">Ngày {dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
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

        {!loading && !hasData && (
          <p className="p-5 text-sm text-brand-navy-soft text-center">
            Chưa có phiếu nào cho ngày này.
          </p>
        )}

        {!loading && hasData && (
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

      {/* Off-screen share view — chỉ dùng làm nguồn cho html-to-image.
          Layout inline-styles + plain spans, không dùng flex gap để
          tránh quirks của html-to-image. Position fixed kèm opacity 0
          để không ảnh hưởng UI nhưng vẫn có kích thước thực để render. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          opacity: 0,
          zIndex: -1,
        }}
      >
        <div
          ref={shareViewRef}
          style={{
            width: 480,
            background: '#ffffff',
            color: '#1b3864',
            fontFamily: SHARE_FONT,
            border: '1px solid #e8f0fb',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px 16px 24px',
              borderBottom: '1px solid #e8f0fb',
              background: 'linear-gradient(135deg, #f0f5ff 0%, #ffffff 100%)',
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#1b3864',
                lineHeight: 1.2,
              }}
            >
              Tăng ca hôm nay
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#063882',
                marginTop: 6,
              }}
            >
              Ngày {dateLabel}
            </div>
          </div>

          {showHD && hd.length > 0 && (
            <ShareDept
              title="HD"
              color="#063882"
              employees={hd}
              totalMachines={hdMachines}
            />
          )}
          {showRL && rl.length > 0 && (
            <ShareDept
              title="RL"
              color="#2db5a1"
              employees={rl}
              totalMachines={rlMachines}
            />
          )}
        </div>
      </div>
    </>
  );
}

function ShareDept({
  title,
  color,
  employees,
  totalMachines,
}: {
  title: string;
  color: string;
  employees: EmpRow[];
  totalMachines: number;
}) {
  return (
    <div
      style={{
        padding: '18px 24px',
        borderTop: '1px solid #e8f0fb',
      }}
    >
      <div style={{ marginBottom: 14, fontSize: 14, lineHeight: 1 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 9px',
            borderRadius: 6,
            color: 'white',
            background: color,
            verticalAlign: 'middle',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#1b3864',
            marginLeft: 10,
            verticalAlign: 'middle',
          }}
        >
          {employees.length} người
        </span>
        <span
          style={{
            fontSize: 13,
            color: '#3b5788',
            marginLeft: 8,
            verticalAlign: 'middle',
          }}
        >
          · {totalMachines} máy
        </span>
      </div>

      {employees.map((emp, i) => (
        <div
          key={emp.employee_id}
          style={{
            marginBottom: i === employees.length - 1 ? 0 : 12,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#1b3864',
              lineHeight: 1.35,
            }}
          >
            {i + 1}. {toTitleCase(emp.employee_name)}
          </div>
          <div
            style={{
              fontSize: 14,
              color: '#1b3864',
              marginTop: 3,
              marginLeft: 18,
              lineHeight: 1.45,
              wordBreak: 'break-word',
            }}
          >
            {formatMachinesDetailed(emp.machines)}
          </div>
        </div>
      ))}
    </div>
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
