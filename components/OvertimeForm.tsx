'use client';

import { useEffect, useState } from 'react';
import MaterialLabelsUpload from './MaterialLabelsUpload';

type Employee = { id: string; full_name: string; order_no: number };
type Machine = { id: string; code: string; rpm: number; spec: string };
type PlanItem = { item_code: string; item_name: string | null };
type MyRegistration = {
  id: string;
  day_type: 'weekday' | 'sunday';
  time_from: string;
  time_to: string;
  duration_hours: number;
  created_at: string;
  items_count: number;
};

type Row = {
  employeeId: string;
  equipmentId: string;
  itemCode: string;
  planItems: PlanItem[];
  loadingItems: boolean;
};

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const emptyRow = (): Row => ({
  employeeId: '',
  equipmentId: '',
  itemCode: '',
  planItems: [],
  loadingItems: false,
});

export default function OvertimeForm({ department }: { department: string }) {
  const [date, setDate] = useState(todayISO());
  const [dayType, setDayType] = useState<'weekday' | 'sunday'>('weekday');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myRegs, setMyRegs] = useState<MyRegistration[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const duration = dayType === 'weekday' ? 2.5 : 8;
  const timeLabel = dayType === 'weekday' ? '16:30 – 19:30 (2.5 giờ)' : '06:00 – 14:00 (8 giờ)';

  useEffect(() => {
    let cancelled = false;
    setLoadingOpts(true);
    setError('');
    setRows([emptyRow()]);
    fetch(`/api/register/options?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          setEmployees([]);
          setMachines([]);
          return;
        }
        setEmployees(d.employees ?? []);
        setMachines(d.machines ?? []);
      })
      .catch(() => !cancelled && setError('Không tải được dữ liệu'))
      .finally(() => !cancelled && setLoadingOpts(false));
    return () => {
      cancelled = true;
    };
  }, [date]);

  async function loadMyRegs() {
    try {
      const res = await fetch(`/api/registrations/mine?date=${date}`);
      const data = await res.json();
      setMyRegs(data.registrations ?? []);
    } catch {
      setMyRegs([]);
    }
  }

  useEffect(() => {
    loadMyRegs();
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
      await loadMyRegs();
    } finally {
      setDeletingId(null);
    }
  }

  async function onMachineChange(idx: number, equipmentId: string) {
    const machine = machines.find((m) => m.id === equipmentId);
    setRows((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        equipmentId,
        itemCode: '',
        planItems: [],
        loadingItems: !!machine,
      };
      return next;
    });
    if (!machine) return;
    try {
      const res = await fetch(
        `/api/register/items?date=${date}&equipment_code=${encodeURIComponent(machine.code)}`,
      );
      const data = await res.json();
      setRows((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], planItems: data.items ?? [], loadingItems: false };
        return next;
      });
    } catch {
      setRows((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], loadingItems: false };
        return next;
      });
    }
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function plannedQty(rpm: number) {
    return Math.round(rpm * 60 * duration);
  }

  async function submit() {
    setError('');
    setSuccess('');

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.employeeId) return setError(`Dòng ${i + 1}: chưa chọn nhân viên`);
      if (!r.equipmentId) return setError(`Dòng ${i + 1}: chưa chọn thiết bị`);
      if (!r.itemCode) return setError(`Dòng ${i + 1}: chưa chọn mã hàng`);
    }

    const items = rows.map((r) => {
      const machine = machines.find((m) => m.id === r.equipmentId)!;
      const pi = r.planItems.find((p) => p.item_code === r.itemCode);
      return {
        employee_id: r.employeeId,
        equipment_id: r.equipmentId,
        item_code: r.itemCode,
        item_name: pi?.item_name ?? null,
        planned_quantity: plannedQty(machine.rpm),
      };
    });

    setSubmitting(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overtime_date: date, day_type: dayType, items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Không gửi được phiếu');
        return;
      }
      setSuccess(`Đã gửi phiếu với ${data.items_count} dòng. (ID: ${data.id.slice(0, 8)}…)`);
      setRows([emptyRow()]);
      loadMyRegs();
    } finally {
      setSubmitting(false);
    }
  }

  const noPlan = !loadingOpts && machines.length === 0;

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
          <span className="block text-sm font-semibold text-brand-navy mb-1.5">Loại ngày</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDayType('weekday')}
              className={`py-2.5 rounded-md border text-sm font-medium transition ${
                dayType === 'weekday'
                  ? 'bg-brand-teal text-white border-brand-teal'
                  : 'bg-white text-brand-navy border-gray-300 hover:border-brand-teal'
              }`}
            >
              Ngày thường
            </button>
            <button
              type="button"
              onClick={() => setDayType('sunday')}
              className={`py-2.5 rounded-md border text-sm font-medium transition ${
                dayType === 'sunday'
                  ? 'bg-brand-teal text-white border-brand-teal'
                  : 'bg-white text-brand-navy border-gray-300 hover:border-brand-teal'
              }`}
            >
              Chủ nhật
            </button>
          </div>
          <p className="text-xs text-brand-navy-soft mt-1.5">{timeLabel}</p>
        </div>
      </div>

      {loadingOpts && (
        <p className="text-sm text-brand-navy-soft text-center py-4">Đang tải dữ liệu...</p>
      )}

      {noPlan && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-md">
          Ngày <strong>{date}</strong> chưa có kế hoạch sản xuất. Liên hệ admin upload kế hoạch
          trước.
        </div>
      )}

      {!loadingOpts && machines.length > 0 && (
        <>
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const machine = machines.find((m) => m.id === row.equipmentId);
              const qty = machine ? plannedQty(machine.rpm) : null;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-navy-soft uppercase tracking-wide">
                      Dòng {idx + 1}
                    </span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Xóa dòng
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-brand-navy mb-1">
                      Nhân viên
                    </label>
                    <select
                      value={row.employeeId}
                      onChange={(e) => updateRow(idx, { employeeId: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                    >
                      <option value="">— Chọn nhân viên —</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.order_no}. {e.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-brand-navy mb-1">
                      Thiết bị
                    </label>
                    <select
                      value={row.equipmentId}
                      onChange={(e) => onMachineChange(idx, e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                    >
                      <option value="">— Chọn máy —</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} ({m.spec}, {m.rpm} RPM)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-brand-navy mb-1">
                      Mã hàng
                    </label>
                    <select
                      value={row.itemCode}
                      onChange={(e) => updateRow(idx, { itemCode: e.target.value })}
                      disabled={!row.equipmentId || row.loadingItems}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy bg-white disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                    >
                      <option value="">
                        {row.loadingItems
                          ? 'Đang tải mã hàng...'
                          : !row.equipmentId
                            ? '— Chọn máy trước —'
                            : row.planItems.length === 0
                              ? '— Máy không có mã hàng trong kế hoạch —'
                              : '— Chọn mã hàng —'}
                      </option>
                      {row.planItems.map((p) => (
                        <option key={p.item_code} value={p.item_code}>
                          {p.item_code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {qty !== null && (
                    <div className="bg-brand-surface-alt rounded-md px-3 py-2 text-sm">
                      <span className="text-brand-navy-soft">SL dự kiến: </span>
                      <span className="font-semibold text-brand-navy">
                        {qty.toLocaleString('vi-VN')} pcs
                      </span>
                      <span className="text-xs text-brand-navy-soft">
                        {' '}
                        ({machine?.rpm} × 60 × {duration}h)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full py-2.5 rounded-md border border-dashed border-brand-teal text-brand-teal font-medium hover:bg-brand-teal/5 transition"
          >
            + Thêm dòng
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

      {!loadingOpts && machines.length > 0 && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="w-full bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-md transition shadow-md shadow-brand-teal/30"
        >
          {submitting ? 'Đang gửi...' : `Gửi phiếu (${rows.length} dòng) • Bộ phận ${department}`}
        </button>
      )}

      {department === 'HD' && <MaterialLabelsUpload date={date} />}

      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden mt-6">
        <div className="p-4 border-b border-brand-surface-alt">
          <h2 className="text-base font-semibold text-brand-navy">
            Phiếu đã gửi cho ngày {date}
          </h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            {myRegs.length === 0 ? 'Chưa có phiếu nào.' : `${myRegs.length} phiếu`}
          </p>
        </div>
        {myRegs.length > 0 && (
          <ul className="divide-y divide-brand-surface-alt">
            {myRegs.map((r) => {
              const createdAt = new Date(r.created_at);
              const timeStr = `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
              return (
                <li key={r.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-brand-navy">
                      {r.day_type === 'weekday' ? 'Ngày thường' : 'Chủ nhật'} • {r.items_count} dòng
                    </div>
                    <div className="text-xs text-brand-navy-soft">
                      {r.time_from.slice(0, 5)}–{r.time_to.slice(0, 5)} ({r.duration_hours}h) • gửi lúc {timeStr}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-60 transition font-medium"
                  >
                    {deletingId === r.id ? 'Đang xóa...' : 'Xóa'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
