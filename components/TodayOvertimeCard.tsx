'use client';

import { useEffect, useState } from 'react';
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

// Format danh sách máy theo dạng chi tiết, KHÔNG gộp M3/M4 (gộp chỉ dùng cho phiếu in).
// VD: [HD-9A, HD-9B, HD-10] → "HD-9A, HD-9B, HD-10"
// CVK hiển thị "Công việc khác: <mô tả>" và xếp cuối.
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

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-surface-alt flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Tăng ca hôm nay</h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Danh sách NV đăng ký theo bộ phận, ngày {date}
          </p>
        </div>
        {!hideDatePicker && (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        )}
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
          <li
            key={emp.employee_id}
            className="text-sm leading-snug"
          >
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
