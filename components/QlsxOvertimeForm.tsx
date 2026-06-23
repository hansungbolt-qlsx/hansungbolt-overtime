'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toTitleCase } from '@/lib/format';

type Employee = { id: string; full_name: string; order_no: number };

type EmployeeRow = {
  employeeId: string;
  reason: string;
};

const emptyRow = (): EmployeeRow => ({ employeeId: '', reason: '' });

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function QlsxOvertimeForm({
  employees,
  defaultRequestor,
}: {
  employees: Employee[];
  defaultRequestor: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [dayType, setDayType] = useState<'weekday' | 'sunday' | null>(null);
  const [rows, setRows] = useState<EmployeeRow[]>([emptyRow()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const timeLabel =
    dayType === 'weekday'
      ? '16:30 – 19:30 (3 giờ)'
      : dayType === 'sunday'
        ? '06:00 – 14:00 (8 giờ)'
        : 'Chọn loại ngày để bắt đầu thêm nhân viên';

  function updateEmployee(idx: number, employeeId: string) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], employeeId };
      return next;
    });
  }

  function updateReason(idx: number, reason: string) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], reason };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(idx: number) {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  }

  async function submit() {
    setError('');
    setSuccess('');
    if (!dayType) return setError('Chưa chọn loại ngày');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.employeeId)
        return setError(`Nhân viên ${i + 1}: chưa chọn tên`);
      if (!r.reason.trim())
        return setError(`Nhân viên ${i + 1}: chưa nhập lý do tăng ca`);
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/registrations/qlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overtime_date: date,
          day_type: dayType,
          items: rows.map((r) => ({
            employee_id: r.employeeId,
            reason: r.reason.trim(),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Không gửi được phiếu');
        return;
      }
      setSuccess(`Đã gửi phiếu với ${data.items_count} dòng.`);
      setRows([emptyRow()]);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-1.5">
            Ngày tăng ca
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
          />
        </div>
        <div>
          <span className="block text-sm font-semibold text-brand-navy mb-1.5">
            Loại ngày
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(['weekday', 'sunday'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDayType(type)}
                className={`py-2.5 rounded-md border text-sm font-medium transition ${
                  dayType === type
                    ? 'bg-brand-teal text-white border-brand-teal'
                    : 'bg-white text-brand-navy border-gray-300 hover:border-brand-teal'
                }`}
              >
                {type === 'weekday' ? 'Ngày thường' : 'Chủ nhật'}
              </button>
            ))}
          </div>
          <p
            className={`text-xs mt-1.5 ${dayType ? 'text-brand-navy-soft' : 'text-brand-teal font-medium'}`}
          >
            {timeLabel}
          </p>
        </div>
        <div className="text-xs text-brand-navy-soft border-t border-brand-surface-alt pt-3">
          Người yêu cầu: <strong className="text-brand-navy">{toTitleCase(defaultRequestor)}</strong>
        </div>
      </div>

      {dayType && (
        <>
          <div className="space-y-4">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-navy-soft uppercase tracking-wide">
                    Nhân viên {idx + 1}
                  </span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Xóa
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-navy mb-1">
                    Tên nhân viên
                  </label>
                  <select
                    value={row.employeeId}
                    onChange={(e) => updateEmployee(idx, e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                  >
                    <option value="">— Chọn nhân viên —</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.order_no}. {toTitleCase(e.full_name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-navy mb-1">
                    Lý do tăng ca
                  </label>
                  <textarea
                    value={row.reason}
                    onChange={(e) => updateReason(idx, e.target.value)}
                    rows={2}
                    placeholder="VD: Họp khẩn cấp với khách hàng, lên kế hoạch sản xuất tuần sau..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent resize-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full py-2.5 rounded-md border border-dashed border-brand-teal text-brand-teal font-medium hover:bg-brand-teal/5 transition"
          >
            + Thêm nhân viên
          </button>
        </>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-md">
          {success}
        </div>
      )}

      {dayType && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="w-full bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-md transition shadow-md shadow-brand-teal/30"
        >
          {submitting ? 'Đang gửi...' : `Gửi phiếu (${rows.length} dòng) • QLSX`}
        </button>
      )}
    </div>
  );
}
