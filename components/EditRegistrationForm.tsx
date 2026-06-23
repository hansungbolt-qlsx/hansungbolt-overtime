'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toTitleCase } from '@/lib/format';

type Reg = {
  id: string;
  department: string;
  overtime_date: string;
  day_type: 'weekday' | 'sunday';
  time_from: string;
  time_to: string;
  duration_hours: number;
};

type Item = {
  id: string;
  employee_id: string;
  equipment_id: string;
  item_code: string;
  item_name: string | null;
  planned_quantity: number | null;
  time_from: string | null;
  time_to: string | null;
  duration_hours: number | null;
};

type Employee = { id: string; full_name: string; order_no: number };
type Equipment = {
  id: string;
  code: string;
  rpm: number;
  spec: string;
  machine_type: string;
};

type RowState = {
  id: string | null; // null cho dòng mới chưa insert
  employee_id: string;
  equipment_id: string;
  item_code: string;
  time_from: string; // "HH:MM"
  time_to: string; // "HH:MM"
};

// "HH:MM:SS" → "HH:MM"
function toHM(t: string | null | undefined): string {
  if (!t) return '';
  return t.slice(0, 5);
}

function diffHours(from: string, to: string): number {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  return (th * 60 + tm - fh * 60 - fm) / 60;
}

// Giờ break cố định 30 phút
function calcQtyHours(duration: number): number {
  return Math.max(0, duration - 0.5);
}

export default function EditRegistrationForm({
  reg,
  items,
  employees,
  equipments,
  backHref,
}: {
  reg: Reg;
  items: Item[];
  employees: Employee[];
  equipments: Equipment[];
  backHref: string;
}) {
  const router = useRouter();
  const headerFrom = toHM(reg.time_from);
  const headerTo = toHM(reg.time_to);

  const [rows, setRows] = useState<RowState[]>(
    items.map((it) => ({
      id: it.id,
      employee_id: it.employee_id,
      equipment_id: it.equipment_id,
      item_code: it.item_code,
      // Dòng chưa có time riêng → fallback giờ header (phiếu mới submit xong)
      time_from: toHM(it.time_from) || headerFrom,
      time_to: toHM(it.time_to) || headerTo,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const eqMap = useMemo(() => new Map(equipments.map((e) => [e.id, e])), [equipments]);

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function removeRow(idx: number) {
    if (rows.length <= 1) {
      alert('Phiếu phải còn ít nhất 1 dòng. Nếu muốn xóa hết, dùng nút Xóa phiếu.');
      return;
    }
    if (!confirm('Xóa dòng này?')) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  // Áp dụng giờ dòng đầu tiên cho tất cả
  function applyFirstTimeToAll() {
    if (rows.length === 0) return;
    const { time_from, time_to } = rows[0];
    if (!confirm(`Đặt giờ ${time_from}–${time_to} cho tất cả ${rows.length} dòng?`)) return;
    setRows((prev) => prev.map((r) => ({ ...r, time_from, time_to })));
  }

  function rowDuration(row: RowState): number {
    return diffHours(row.time_from, row.time_to);
  }

  function rowQty(row: RowState): string {
    const eq = eqMap.get(row.equipment_id);
    if (!eq) return '—';
    if (eq.machine_type === 'OTHER') return '—';
    const d = rowDuration(row);
    if (d <= 0) return '—';
    const qtyH = calcQtyHours(d);
    return Math.round(eq.rpm * 60 * qtyH).toLocaleString('en-US');
  }

  async function save() {
    setError('');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.employee_id) return setError(`Dòng ${i + 1}: chưa chọn nhân viên`);
      if (!r.equipment_id) return setError(`Dòng ${i + 1}: chưa chọn máy/thiết bị`);
      if (!r.item_code.trim()) return setError(`Dòng ${i + 1}: chưa nhập mã hàng`);
      if (!r.time_from || !r.time_to)
        return setError(`Dòng ${i + 1}: chưa nhập giờ`);
      if (rowDuration(r) <= 0)
        return setError(`Dòng ${i + 1}: giờ kết thúc phải sau giờ bắt đầu`);
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/registrations/${reg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map((r) => ({
            id: r.id,
            employee_id: r.employee_id,
            equipment_id: r.equipment_id,
            item_code: r.item_code.trim(),
            time_from: r.time_from,
            time_to: r.time_to,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Không lưu được phiếu');
        return;
      }
      router.push(backHref);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-brand-navy">Sửa phiếu tăng ca</h1>
          <p className="text-sm text-brand-navy-soft">
            Ngày {reg.overtime_date} • Bộ phận {reg.department} •{' '}
            {reg.day_type === 'weekday' ? 'Ngày thường' : 'Chủ nhật'}
          </p>
        </div>
        <Link
          href={backHref}
          className="text-sm text-brand-navy-soft hover:text-brand-navy"
        >
          ← Quay lại
        </Link>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
        <div className="p-5 border-b border-brand-surface-alt flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-navy">
              Chi tiết ({rows.length} dòng)
            </h2>
            <p className="text-xs text-brand-navy-soft mt-0.5">
              Mỗi dòng có giờ riêng — SL dự kiến tự tính = RPM × 60 × (tổng giờ − 0.5h break).
            </p>
          </div>
          <button
            type="button"
            onClick={applyFirstTimeToAll}
            className="text-xs px-3 py-1.5 border border-brand-teal text-brand-teal rounded-md hover:bg-brand-teal/5 font-medium whitespace-nowrap"
          >
            Áp giờ dòng 1 cho tất cả
          </button>
        </div>
        <ul className="divide-y divide-brand-surface-alt">
          {rows.map((row, idx) => {
            const eq = eqMap.get(row.equipment_id);
            const isOther = eq?.machine_type === 'OTHER';
            const d = rowDuration(row);
            return (
              <li key={idx} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-navy-soft uppercase">
                    Dòng {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Xóa dòng
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy mb-1">
                      Nhân viên
                    </label>
                    <select
                      value={row.employee_id}
                      onChange={(e) => updateRow(idx, { employee_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-brand-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
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
                      Máy / Thiết bị
                    </label>
                    <select
                      value={row.equipment_id}
                      onChange={(e) => updateRow(idx, { equipment_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-brand-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    >
                      <option value="">— Chọn máy —</option>
                      {equipments.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.machine_type === 'OTHER'
                            ? 'Công việc khác'
                            : `${eq.code}${eq.spec ? ' — ' + eq.spec : ''} (RPM ${eq.rpm})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-brand-navy mb-1">
                        Từ
                      </label>
                      <input
                        type="time"
                        value={row.time_from}
                        onChange={(e) => updateRow(idx, { time_from: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-brand-navy mb-1">
                        Đến
                      </label>
                      <input
                        type="time"
                        value={row.time_to}
                        onChange={(e) => updateRow(idx, { time_to: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy mb-1">
                      Số lượng dự kiến
                    </label>
                    <div className="px-3 py-2 bg-brand-surface/50 border border-brand-surface-alt rounded-md text-brand-navy font-semibold">
                      {rowQty(row)}
                      {d > 0 && !isOther && (
                        <span className="ml-2 text-xs font-normal text-brand-navy-soft">
                          ({d}h)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-brand-navy mb-1">
                      Mã hàng{' '}
                      {isOther && (
                        <span className="text-amber-700">(nội dung công việc)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={row.item_code}
                      onChange={(e) => updateRow(idx, { item_code: e.target.value })}
                      placeholder={isOther ? 'VD: Vệ sinh máy lạnh' : 'Nhập mã hàng'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-60 text-white font-semibold py-3 rounded-md transition shadow-md shadow-brand-teal/30"
        >
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
        <Link
          href={backHref}
          className="px-6 py-3 border border-gray-300 text-brand-navy hover:bg-gray-50 rounded-md font-semibold transition"
        >
          Hủy
        </Link>
      </div>
    </div>
  );
}
