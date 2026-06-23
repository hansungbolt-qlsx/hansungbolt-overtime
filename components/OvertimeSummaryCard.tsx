'use client';

import { useEffect, useMemo, useState } from 'react';
import { toTitleCase } from '@/lib/format';

type SummaryRow = {
  employee_id: string;
  employee_name: string;
  employee_department: 'HD' | 'RL' | null;
  weekday_count: number;
  sunday_count: number;
  total_hours: number;
};

function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function OvertimeSummaryCard() {
  const [month, setMonth] = useState(currentMonthISO());
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDept, setActiveDept] = useState<'HD' | 'RL' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/registrations/summary?month=${month}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRows(d.summary ?? []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  // Admin sẽ thấy cả HD lẫn RL → bật tabs. Leader/worker chỉ thấy 1 dept → không cần tab.
  const distinctDepts = useMemo(() => {
    const s = new Set<'HD' | 'RL'>();
    for (const r of rows) if (r.employee_department) s.add(r.employee_department);
    return Array.from(s);
  }, [rows]);
  const showTabs = distinctDepts.length >= 2;

  useEffect(() => {
    if (!showTabs) {
      setActiveDept(null);
      return;
    }
    setActiveDept((prev) => {
      if (prev && distinctDepts.includes(prev)) return prev;
      return distinctDepts.includes('HD') ? 'HD' : distinctDepts[0];
    });
  }, [showTabs, distinctDepts]);

  const displayRows = useMemo(() => {
    if (!showTabs || !activeDept) return rows;
    return rows.filter((r) => r.employee_department === activeDept);
  }, [rows, showTabs, activeDept]);

  const totalHours = displayRows.reduce((s, r) => s + r.total_hours, 0);

  const printDeptParam = showTabs && activeDept ? `&dept=${activeDept}` : '';
  const previewUrl = `/print/overtime-summary?month=${month}&preview=1${printDeptParam}`;
  const printUrl = `/print/overtime-summary?month=${month}${printDeptParam}`;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-surface-alt flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Tổng hợp giờ tăng ca</h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Tổng giờ = tổng giờ thực tế từng phiếu (admin sửa được per-người)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
          {displayRows.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => window.open(previewUrl, '_blank')}
                className="bg-[#063882] hover:bg-[#052a64] active:scale-95 text-white text-sm font-bold py-1.5 px-4 rounded-lg shadow-sm transition"
              >
                Xem
              </button>
              <button
                type="button"
                onClick={() => window.open(printUrl, '_blank')}
                className="bg-[#e32531] hover:bg-[#c01f2a] active:scale-95 text-white text-sm font-bold py-1.5 px-4 rounded-lg shadow-sm transition"
              >
                In / Xuất
              </button>
            </>
          )}
        </div>
      </div>

      {showTabs && (
        <div className="flex gap-1 px-5 pt-3 bg-white border-b border-brand-surface-alt">
          {(['HD', 'RL'] as const).map((d) => {
            const isActive = activeDept === d;
            const hasData = distinctDepts.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDept(d)}
                disabled={!hasData}
                className={`px-5 py-2 text-sm font-bold rounded-t-lg border border-b-0 transition ${
                  isActive
                    ? 'bg-[#dce8fa] text-[#063882] border-[#dce8fa] -mb-px'
                    : hasData
                      ? 'bg-white text-brand-navy-soft border-transparent hover:bg-[#f0f5ff]'
                      : 'bg-white text-gray-300 border-transparent cursor-not-allowed'
                }`}
              >
                Bộ phận {d}
                {hasData && (
                  <span className="ml-2 text-[10px] font-normal opacity-70">
                    ({rows.filter((r) => r.employee_department === d).length})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-4 bg-[#f0f5ff] min-h-[80px]">
        {loading && (
          <p className="text-sm text-brand-navy-soft text-center py-4">Đang tải...</p>
        )}
        {!loading && displayRows.length === 0 && (
          <p className="text-sm text-brand-navy-soft text-center py-4">
            {showTabs && activeDept
              ? `Chưa có dữ liệu bộ phận ${activeDept} tháng này.`
              : 'Chưa có dữ liệu tháng này.'}
          </p>
        )}
        {!loading && displayRows.length > 0 && (
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full text-sm bg-white">
              <thead className="bg-[#dce8fa] text-[#063882]">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Nhân viên</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Ngày thường</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Chủ nhật</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Tổng giờ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8f0fb]">
                {displayRows.map((r) => (
                  <tr key={r.employee_id} className="hover:bg-[#f0f5ff]">
                    <td className="px-4 py-2.5 font-semibold text-brand-navy">{toTitleCase(r.employee_name)}</td>
                    <td className="px-4 py-2.5 text-right text-brand-navy-soft">
                      {r.weekday_count > 0 ? `${r.weekday_count} ngày` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-brand-navy-soft">
                      {r.sunday_count > 0 ? `${r.sunday_count} ngày` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#063882]">
                      {r.total_hours}h
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#dce8fa]">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 font-bold text-[#063882] text-right">
                    Tổng cộng
                  </td>
                  <td className="px-4 py-2.5 font-bold text-[#063882] text-right">
                    {Number(totalHours.toFixed(2))}h
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
