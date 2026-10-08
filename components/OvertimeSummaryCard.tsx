'use client';

import { useEffect, useMemo, useState } from 'react';
import { toTitleCase } from '@/lib/format';
import PrintJobButton from './PrintJobButton';

type Dept = 'HD' | 'RL' | 'CO' | 'QLSX';
type ActiveTab = 'all' | Dept;

type SummaryRow = {
  employee_id: string;
  employee_name: string;
  employee_department: Dept | null;
  weekday_count: number;
  sunday_count: number;
  total_hours: number;
  by_date?: Record<string, number>;
};
type DateCol = { date: string; day_type: 'weekday' | 'sunday'; depts: string[] };
type View = 'sum' | 'day';

const DEPT_ORDER: Dept[] = ['HD', 'RL', 'CO', 'QLSX'];

const DEPT_BADGE: Record<Dept, string> = {
  HD: 'bg-[#063882] text-white',
  RL: 'bg-[#2db5a1] text-white',
  CO: 'bg-[#ea580c] text-white',
  QLSX: 'bg-[#7c3aed] text-white',
};

function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function OvertimeSummaryCard({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  const [month, setMonth] = useState(currentMonthISO());
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  // Tab Chi tiết theo ngày (anh Hữu 08/10/2026): người × ngày như phiếu in Tổng hợp giờ tăng ca
  const [view, setView] = useState<View>('sum');
  const [dates, setDates] = useState<DateCol[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/registrations/summary?month=${month}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.summary ?? []); setDates(d.dates ?? []); } })
      .catch(() => { if (!cancelled) { setRows([]); setDates([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  // Detect các dept có dữ liệu, sort theo DEPT_ORDER (HD, RL, QLSX)
  const distinctDepts = useMemo<Dept[]>(() => {
    const s = new Set<Dept>();
    for (const r of rows) if (r.employee_department) s.add(r.employee_department);
    return DEPT_ORDER.filter((d) => s.has(d));
  }, [rows]);

  // Hiện tabs khi có ≥ 2 dept (admin xem cả HD/RL/QLSX). Leader/worker chỉ thấy
  // 1 dept của mình → không có tab.
  const showTabs = distinctDepts.length >= 2;

  // Nếu tab đang chọn không còn data (vd đổi tháng) → reset về 'all'
  useEffect(() => {
    if (!showTabs) {
      setActiveTab('all');
      return;
    }
    setActiveTab((prev) => {
      if (prev === 'all') return prev;
      if (distinctDepts.includes(prev)) return prev;
      return 'all';
    });
  }, [showTabs, distinctDepts]);

  // Display rows: tab 'all' show tất cả (sort theo dept rồi full_name);
  // tab dept cụ thể: filter
  const displayRows = useMemo(() => {
    if (activeTab === 'all') {
      return [...rows].sort((a, b) => {
        const ai = a.employee_department ? DEPT_ORDER.indexOf(a.employee_department) : 99;
        const bi = b.employee_department ? DEPT_ORDER.indexOf(b.employee_department) : 99;
        if (ai !== bi) return ai - bi;
        return a.employee_name.localeCompare(b.employee_name, 'vi');
      });
    }
    return rows.filter((r) => r.employee_department === activeTab);
  }, [rows, activeTab]);

  const totalHours = displayRows.reduce((s, r) => s + r.total_hours, 0);
  // Cột ngày: tab bộ phận chỉ ngày có phiếu của bộ phận đó (= trang in ?dept=)
  const dayCols = activeTab === 'all' ? dates : dates.filter((d) => d.depts.includes(activeTab));
  const hrs = (v: number) => `${Number(v.toFixed(2))}h`;

  // URL print/preview: 'all' tab không pass dept → backend trả về cả 3
  const printDeptParam = activeTab !== 'all' ? `&dept=${activeTab}` : '';
  const previewUrl = `/print/overtime-summary?month=${month}&preview=1${printDeptParam}`;
  const printUrl = `/print/overtime-summary?month=${month}${printDeptParam}`;

  // ref_id cho print job: 'YYYY-MM' hoặc 'YYYY-MM|DEPT'
  const printJobRefId = activeTab !== 'all' ? `${month}|${activeTab}` : month;

  // Cột 'Bộ phận' chỉ hiển thị khi admin xem tab 'Tất cả' (có nhiều dept).
  // Non-admin chỉ có 1 dept -> ẩn cột này (redundant).
  const showDeptColumn = showTabs && activeTab === 'all';

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
              <PrintJobButton
                type="overtime_summary"
                refId={printJobRefId}
                label="In phiếu"
                compact
              />
              {/* Admin có thêm nút Xem/In-Xuất trực tiếp qua browser
                  (ngồi máy tính, gần máy in). Leader/worker chỉ Gửi in qua agent. */}
              {isAdmin && (
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
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-5 pt-3 bg-white">
        {([['sum', 'Tổng hợp'], ['day', 'Chi tiết theo ngày']] as [View, string][]).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm font-bold rounded-full border transition whitespace-nowrap ${
              view === v
                ? 'bg-[#063882] text-white border-[#063882]'
                : 'bg-white text-[#063882] border-[#bbd0f0] hover:bg-[#f0f5ff]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showTabs && (
        <div className="flex gap-1 px-5 pt-3 bg-white border-b border-brand-surface-alt overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-5 py-2 text-sm font-bold rounded-t-lg border border-b-0 transition whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[#dce8fa] text-[#063882] border-[#dce8fa] -mb-px'
                : 'bg-white text-brand-navy-soft border-transparent hover:bg-[#f0f5ff]'
            }`}
          >
            Tất cả
            <span className="ml-2 text-[10px] font-normal opacity-70">
              ({rows.length})
            </span>
          </button>
          {distinctDepts.map((d) => {
            const isActive = activeTab === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveTab(d)}
                className={`px-5 py-2 text-sm font-bold rounded-t-lg border border-b-0 transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#dce8fa] text-[#063882] border-[#dce8fa] -mb-px'
                    : 'bg-white text-brand-navy-soft border-transparent hover:bg-[#f0f5ff]'
                }`}
              >
                Bộ phận {d}
                <span className="ml-2 text-[10px] font-normal opacity-70">
                  ({rows.filter((r) => r.employee_department === d).length})
                </span>
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
            {showTabs && activeTab !== 'all'
              ? `Chưa có dữ liệu bộ phận ${activeTab} tháng này.`
              : 'Chưa có dữ liệu tháng này.'}
          </p>
        )}
        {!loading && displayRows.length > 0 && view === 'day' && (
          <div className="overflow-x-auto rounded-lg">
            <table className="text-sm bg-white border-separate border-spacing-0 border-l border-t border-[#9db4d6] whitespace-nowrap">
              <thead className="text-[#063882]">
                <tr>
                  <th className="sticky left-0 z-10 w-10 min-w-10 max-w-10 bg-[#d0dff5] border-r border-b border-[#9db4d6] px-2 py-2 w-8">STT</th>
                  <th className="sticky left-10 z-10 bg-[#d0dff5] border-r border-b border-[#9db4d6] px-3 py-2 text-left">Họ và tên</th>
                  {dayCols.map((d) => (
                    <th
                      key={d.date}
                      className={`border-r border-b border-[#9db4d6] px-2 py-1 min-w-[44px] ${d.day_type === 'sunday' ? 'bg-[#f5e0c0]' : 'bg-[#d0dff5]'}`}
                    >
                      {d.date.slice(8)}
                      {d.day_type === 'sunday' && <div className="text-[10px] font-normal leading-none">CN</div>}
                    </th>
                  ))}
                  <th className="border-r border-b border-[#9db4d6] bg-[#bbd0f0] px-2 py-1 leading-tight">Ngày<br />thường</th>
                  <th className="border-r border-b border-[#9db4d6] bg-[#bbd0f0] px-2 py-1 leading-tight">Chủ<br />nhật</th>
                  <th className="border-r border-b border-[#9db4d6] bg-[#bbd0f0] px-2 py-1 leading-tight">Tổng<br />giờ</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, idx) => {
                  const bd = r.by_date ?? {};
                  const wk = dayCols.filter((d) => d.day_type === 'weekday').reduce((s, d) => s + (bd[d.date] ?? 0), 0);
                  const sun = dayCols.filter((d) => d.day_type === 'sunday').reduce((s, d) => s + (bd[d.date] ?? 0), 0);
                  return (
                    <tr key={r.employee_id}>
                      <td className="sticky left-0 z-10 w-10 min-w-10 max-w-10 bg-white border-r border-b border-[#9db4d6] px-2 py-2 text-center">{idx + 1}</td>
                      <td className="sticky left-10 z-10 bg-white border-r border-b border-[#9db4d6] px-3 py-2 font-semibold text-brand-navy">
                        {toTitleCase(r.employee_name)}
                      </td>
                      {dayCols.map((d) => {
                        const h = bd[d.date];
                        return (
                          <td
                            key={d.date}
                            className={`border-r border-b border-[#9db4d6] px-2 py-2 text-center ${
                              h ? `font-bold ${d.day_type === 'sunday' ? 'bg-[#fff0d0]' : 'bg-[#e8f4e8]'}` : ''
                            }`}
                          >
                            {h ? hrs(h) : ''}
                          </td>
                        );
                      })}
                      <td className="border-r border-b border-[#9db4d6] bg-[#dce8fa] px-2 py-2 text-center font-bold">{wk > 0 ? hrs(wk) : ''}</td>
                      <td className="border-r border-b border-[#9db4d6] bg-[#dce8fa] px-2 py-2 text-center font-bold">{sun > 0 ? hrs(sun) : ''}</td>
                      <td className="border-r border-b border-[#9db4d6] bg-[#dce8fa] px-2 py-2 text-center font-bold text-[#063882]">
                        {wk + sun > 0 ? hrs(wk + sun) : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#dce8fa] font-bold text-[#063882]">
                <tr>
                  <td className="sticky left-0 z-10 w-10 min-w-10 max-w-10 bg-[#dce8fa] border-r border-b border-[#9db4d6]"></td>
                  <td className="sticky left-10 z-10 bg-[#dce8fa] border-r border-b border-[#9db4d6] px-3 py-2 text-right italic">Tổng cộng</td>
                  {dayCols.map((d) => {
                    const t = displayRows.reduce((s, r) => s + ((r.by_date ?? {})[d.date] ?? 0), 0);
                    return <td key={d.date} className="border-r border-b border-[#9db4d6] px-2 py-2 text-center">{t > 0 ? hrs(t) : ''}</td>;
                  })}
                  <td className="border-r border-b border-[#9db4d6]"></td>
                  <td className="border-r border-b border-[#9db4d6]"></td>
                  <td className="border-r border-b border-[#9db4d6] px-2 py-2 text-center">
                    {hrs(displayRows.reduce((s, r) => s + dayCols.reduce((a, d) => a + ((r.by_date ?? {})[d.date] ?? 0), 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="flex gap-4 mt-2 text-xs text-brand-navy-soft">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 border border-gray-400 bg-[#e8f4e8]" />Ngày thường</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 border border-gray-400 bg-[#fff0d0]" />Chủ nhật</span>
            </div>
          </div>
        )}
        {!loading && displayRows.length > 0 && view === 'sum' && (
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full text-sm bg-white">
              <thead className="bg-[#dce8fa] text-[#063882]">
                <tr>
                  {showDeptColumn && (
                    <th className="text-left px-4 py-2.5 font-semibold w-20">Bộ phận</th>
                  )}
                  <th className="text-left px-4 py-2.5 font-semibold">Nhân viên</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Ngày thường</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Chủ nhật</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Tổng giờ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8f0fb]">
                {displayRows.map((r) => (
                  <tr key={r.employee_id} className="hover:bg-[#f0f5ff]">
                    {showDeptColumn && (
                      <td className="px-4 py-2.5">
                        {r.employee_department && (
                          <span
                            className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${DEPT_BADGE[r.employee_department]}`}
                          >
                            {r.employee_department}
                          </span>
                        )}
                      </td>
                    )}
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
                  <td
                    colSpan={showDeptColumn ? 4 : 3}
                    className="px-4 py-2.5 font-bold text-[#063882] text-right"
                  >
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
