'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toTitleCase } from '@/lib/format';
import PrintJobButton from './PrintJobButton';
import DateButton from './DateButton';

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadRegs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/registrations/department?date=${date}`);
      const d = await res.json();
      setRegs(d.registrations ?? []);
    } catch {
      setRegs([]);
    } finally {
      setLoading(false);
    }
  }

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

  async function handleDelete(id: string) {
    if (!confirm('Xóa phiếu này? Thao tác không thể khôi phục.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Xóa thất bại: ${data.error ?? res.statusText}`);
        return;
      }
      await loadRegs();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      <div className="px-4 py-3.5 border-b border-brand-surface-alt flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-brand-navy leading-tight">
            Danh sách phiếu tăng ca ngày {date}
          </h2>
          <DateButton value={date} onChange={setDate} compact />
        </div>
        <p className="text-xs text-brand-navy-soft">
          {loading ? 'Đang tải...' : regs.length === 0 ? 'Chưa có phiếu nào.' : `${regs.length} phiếu`}
        </p>
      </div>

      {regs.length > 0 && (
        <ul className="divide-y divide-brand-surface-alt">
          {regs.map((r) => {
            const isDeleting = deletingId === r.id;
            return (
              <li key={r.id} className="p-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-brand-navy">
                      {r.day_type === 'weekday' ? 'Ngày thường' : 'Chủ nhật'}
                      <span className="text-brand-navy-soft font-normal ml-2">
                        • {r.items_count} dòng
                      </span>
                    </div>
                    <div className="text-xs text-brand-navy-soft mt-0.5">
                      {formatTime(r.time_from)}–{formatTime(r.time_to)} ({r.duration_hours}h)
                      {r.registered_by_name && (
                        <> • {toTitleCase(r.registered_by_name)}</>
                      )}
                    </div>
                    <div className="text-[11px] text-brand-navy-soft mt-0.5">
                      Gửi lúc {formatDateTime(r.created_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
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
                      className="inline-flex items-center bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs font-semibold py-1.5 px-3 rounded-md transition"
                    >
                      Sửa
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/registrations/${r.id}/view`}
                    className="inline-flex items-center bg-brand-navy hover:bg-brand-navy-soft text-white text-xs font-semibold py-1.5 px-3 rounded-md transition"
                  >
                    Xem
                  </Link>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      disabled={isDeleting}
                      className="inline-flex items-center bg-white hover:bg-red-50 border border-red-300 text-red-600 text-xs font-semibold py-1.5 px-3 rounded-md transition disabled:opacity-60"
                    >
                      {isDeleting ? 'Đang xóa...' : 'Xóa'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
