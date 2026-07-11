'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toTitleCase } from '@/lib/format';
import PrintJobButton from './PrintJobButton';

type Reg = {
  id: string;
  department: string;
  day_type: 'weekday' | 'sunday';
  time_from: string;
  time_to: string;
  duration_hours: number;
  status: string;
  created_at: string;
  registered_by: string | null;
  registered_by_name: string | null;
  items_count: number;
};

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function formatTime(t: string) {
  return t.slice(0, 5).replace(':', 'h');
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}

export default function DepartmentRegistrationsList({
  canEdit = false,
}: {
  canEdit?: boolean;
} = {}) {
  const [date, setDate] = useState(todayISO());
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/registrations/department?date=${date}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRegs(d.registrations ?? []); })
      .catch(() => { if (!cancelled) setRegs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-surface-alt flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Danh sách phiếu tăng ca</h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            {loading ? 'Đang tải...' : regs.length === 0 ? 'Chưa có phiếu nào.' : `${regs.length} phiếu`}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
        />
      </div>

      {regs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-surface-alt text-brand-navy">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Loại</th>
                <th className="text-left px-3 py-2 font-semibold">Giờ</th>
                <th className="text-right px-3 py-2 font-semibold">Số dòng</th>
                <th className="text-left px-3 py-2 font-semibold">Người tạo</th>
                <th className="text-left px-3 py-2 font-semibold">Gửi lúc</th>
                <th className="text-right px-3 py-2 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-surface-alt">
              {regs.map((r) => (
                <tr key={r.id} className="hover:bg-brand-surface/50">
                  <td className="px-3 py-2.5 text-brand-navy">
                    {r.day_type === 'weekday' ? 'Ngày thường' : 'Chủ nhật'}
                  </td>
                  <td className="px-3 py-2.5 text-brand-navy-soft">
                    {formatTime(r.time_from)}–{formatTime(r.time_to)} ({r.duration_hours}h)
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-brand-navy">
                    {r.items_count}
                  </td>
                  <td className="px-3 py-2.5 text-brand-navy-soft">
                    {toTitleCase(r.registered_by_name) || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-brand-navy-soft whitespace-nowrap">
                    {formatDateTime(r.created_at)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                      {canEdit && (
                        <PrintJobButton
                          type="registration"
                          refId={r.id}
                          label="In phiếu"
                          compact
                        />
                      )}
                      {canEdit && (
                        <Link
                          href={`/dashboard/registrations/${r.id}/edit`}
                          className="bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs font-semibold py-1.5 px-3 rounded-md transition"
                        >
                          Sửa
                        </Link>
                      )}
                      <Link
                        href={`/dashboard/registrations/${r.id}/view`}
                        className="bg-brand-navy hover:bg-brand-navy-soft text-white text-xs font-semibold py-1.5 px-3 rounded-md transition"
                      >
                        Xem
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
