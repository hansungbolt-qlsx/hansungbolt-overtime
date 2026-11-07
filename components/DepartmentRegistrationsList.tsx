'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toTitleCase } from '@/lib/format';
import { shiftLabel } from '@/lib/overtime-shift';
import PrintJobButton from './PrintJobButton';
import DateButton from './DateButton';

type Reg = {
  id: string;
  department: string;
  day_type: 'weekday' | 'sunday';
  shift?: string | null;
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

  // Auto refetch khi OvertimeForm gửi phiếu mới. Nếu event kèm date khác
  // (user submit phiếu cho ngày khác) -> auto chuyển sang ngày đó.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ date?: string }>).detail;
      if (detail?.date && detail.date !== date) {
        setDate(detail.date);
      } else {
        loadRegs();
      }
    };
    window.addEventListener('overtime:registered', handler);
    return () => window.removeEventListener('overtime:registered', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Phiếu bị xóa từ khung cảnh báo trùng ca của form đăng ký → tải lại danh sách
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ from?: string }>).detail?.from === 'list') return; // chính danh sách xóa, đã tải lại
      loadRegs();
    };
    window.addEventListener('overtime:deleted', handler);
    return () => window.removeEventListener('overtime:deleted', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Báo form đăng ký: phiếu cũ đã xóa → bỏ cảnh báo trùng ca (anh Hữu 04/11/2026)
      window.dispatchEvent(new CustomEvent('overtime:deleted', { detail: { id, from: 'list' } }));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      {/* Ngày chỉ nằm ở ô lịch — tiêu đề không lặp ngày (anh Hữu 07/11/2026) */}
      <div className="px-3 py-2.5 border-b border-brand-surface-alt flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-brand-navy leading-tight">
            Danh sách phiếu tăng ca
          </h2>
          <DateButton value={date} onChange={(v) => v && setDate(v)} compact />
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
              <li key={r.id} className="p-3 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-brand-navy">
                      {shiftLabel(r.day_type, r.shift)}
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
