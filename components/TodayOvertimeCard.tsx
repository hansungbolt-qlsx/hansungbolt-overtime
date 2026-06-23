'use client';

import { useEffect, useState } from 'react';
import { toTitleCase } from '@/lib/format';
import { formatMachines } from '@/lib/machine-format';

type EmpRow = {
  employee_id: string;
  employee_name: string;
  order_no: number;
  machines: Array<{ code: string; isOther: boolean; otherText?: string }>;
};
type MachineDetail = {
  equipment_code: string;
  item_code: string | null;
  employee_name: string;
  is_other: boolean;
};
type Summary = {
  date: string;
  departments: { HD: EmpRow[]; RL: EmpRow[] };
  details?: { HD: MachineDetail[]; RL: MachineDetail[] };
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

  const hd = data?.departments.HD ?? [];
  const rl = data?.departments.RL ?? [];
  const hdMachines = hd.reduce((s, e) => s + e.machines.length, 0);
  const rlMachines = rl.reduce((s, e) => s + e.machines.length, 0);
  const hdDetails = data?.details?.HD ?? [];
  const rlDetails = data?.details?.RL ?? [];

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
          <DeptSection
            title="HD"
            accent="#063882"
            employees={hd}
            totalMachines={hdMachines}
            details={hdDetails}
          />
          <DeptSection
            title="RL"
            accent="#2db5a1"
            employees={rl}
            totalMachines={rlMachines}
            details={rlDetails}
          />
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
  details,
}: {
  title: string;
  accent: string;
  employees: EmpRow[];
  totalMachines: number;
  details: MachineDetail[];
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
      <div className="flex items-center gap-2 mb-2">
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
      <ol className="space-y-1.5 mb-3">
        {employees.map((emp, idx) => (
          <li
            key={emp.employee_id}
            className="flex items-start gap-2 text-sm leading-snug"
          >
            <span className="text-brand-navy-soft w-5 flex-shrink-0 tabular-nums text-right">
              {idx + 1}.
            </span>
            <span className="font-semibold text-brand-navy whitespace-nowrap flex-shrink-0">
              {toTitleCase(emp.employee_name)}
            </span>
            <span className="text-brand-navy-soft">—</span>
            <span className="text-brand-navy">{formatMachines(emp.machines)}</span>
          </li>
        ))}
      </ol>

      {details.length > 0 && (
        <div className="mt-3 border-t border-brand-surface-alt pt-3">
          <p className="text-xs font-bold text-brand-navy-soft mb-2 uppercase tracking-wide">
            Chi tiết máy &amp; mã hàng
          </p>
          <div className="overflow-x-auto rounded-lg border border-brand-surface-alt">
            <table className="w-full text-xs">
              <thead className="bg-[#f0f5ff] text-[#063882]">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold w-8">STT</th>
                  <th className="text-left px-2 py-1.5 font-semibold">Máy</th>
                  <th className="text-left px-2 py-1.5 font-semibold">Mã hàng</th>
                  <th className="text-left px-2 py-1.5 font-semibold">Nhân viên</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-surface-alt bg-white">
                {details.map((d, i) => (
                  <tr key={`${d.equipment_code}-${d.employee_name}-${i}`}>
                    <td className="px-2 py-1.5 text-brand-navy-soft tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-2 py-1.5 font-semibold text-brand-navy whitespace-nowrap">
                      {d.is_other ? 'Công việc khác' : d.equipment_code}
                    </td>
                    <td className="px-2 py-1.5 text-brand-navy">
                      {d.item_code ? (
                        d.is_other ? (
                          <em className="text-brand-navy-soft">{d.item_code}</em>
                        ) : (
                          <span className="font-mono">{d.item_code}</span>
                        )
                      ) : (
                        <span className="text-brand-navy-soft">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-brand-navy whitespace-nowrap">
                      {toTitleCase(d.employee_name)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
