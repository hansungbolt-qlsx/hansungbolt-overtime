'use client';

import { useEffect, useState } from 'react';

type SummaryRow = {
  employee_id: string;
  employee_name: string;
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

  const totalHours = rows.reduce((s, r) => s + r.total_hours, 0);

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-surface-alt flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Tổng hợp giờ tăng ca</h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Ngày thường = 3h · Chủ nhật = 8h
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
        />
      </div>

      <div className="p-4 bg-[#f0f5ff] min-h-[80px]">
        {loading && (
          <p className="text-sm text-brand-navy-soft text-center py-4">Đang tải...</p>
        )}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-brand-navy-soft text-center py-4">Chưa có dữ liệu tháng này.</p>
        )}
        {!loading && rows.length > 0 && (
          <>
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
                  {rows.map((r) => (
                    <tr key={r.employee_id} className="hover:bg-[#f0f5ff]">
                      <td className="px-4 py-2.5 font-semibold text-brand-navy">{r.employee_name}</td>
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
                      {totalHours}h
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
