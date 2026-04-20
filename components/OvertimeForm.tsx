'use client';

import { useEffect, useState } from 'react';
import { toTitleCase } from '@/lib/format';

type Employee = { id: string; full_name: string; order_no: number };
type PlanItem = { item_code: string; item_name: string | null };
type Machine = { id: string; code: string; rpm: number; spec: string; items: PlanItem[] };
type MyRegistration = {
  id: string;
  day_type: 'weekday' | 'sunday';
  time_from: string;
  time_to: string;
  duration_hours: number;
  created_at: string;
  items_count: number;
};

type EmployeeRow = {
  employeeId: string;
  checkedMachineIds: string[];
};

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const emptyRow = (): EmployeeRow => ({ employeeId: '', checkedMachineIds: [] });

export default function OvertimeForm({ department }: { department: string }) {
  const [date, setDate] = useState(todayISO());
  const [dayType, setDayType] = useState<'weekday' | 'sunday'>('weekday');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rows, setRows] = useState<EmployeeRow[]>([emptyRow()]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myRegs, setMyRegs] = useState<MyRegistration[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Giờ tính sản lượng (trừ break) — KHÁC giờ hiển thị
  const calcHours = dayType === 'weekday' ? 2.5 : 7.5;
  const timeLabel = dayType === 'weekday' ? '16:30 – 19:30 (3 giờ)' : '06:00 – 14:00 (8 giờ)';
  const totalItems = rows.reduce((sum, row) => sum + row.checkedMachineIds.length, 0);

  useEffect(() => {
    let cancelled = false;
    setLoadingOpts(true);
    setError('');
    setRows([emptyRow()]);
    fetch(`/api/register/options?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) { setError(d.error); setEmployees([]); setMachines([]); return; }
        setEmployees(d.employees ?? []);
        setMachines(d.machines ?? []);
      })
      .catch(() => !cancelled && setError('Không tải được dữ liệu'))
      .finally(() => !cancelled && setLoadingOpts(false));
    return () => { cancelled = true; };
  }, [date]);

  async function loadMyRegs() {
    try {
      const res = await fetch(`/api/registrations/mine?date=${date}`);
      const data = await res.json();
      setMyRegs(data.registrations ?? []);
    } catch { setMyRegs([]); }
  }

  useEffect(() => { loadMyRegs(); }, [date]);

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
    } finally { setDeletingId(null); }
  }

  function toggleMachine(rowIdx: number, machineId: string) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      const already = row.checkedMachineIds.includes(machineId);
      next[rowIdx] = {
        ...row,
        checkedMachineIds: already
          ? row.checkedMachineIds.filter((id) => id !== machineId)
          : [...row.checkedMachineIds, machineId],
      };
      return next;
    });
  }

  function updateEmployee(rowIdx: number, employeeId: string) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], employeeId };
      return next;
    });
  }

  function addRow() { setRows((prev) => [...prev, emptyRow()]); }
  function removeRow(idx: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function plannedQty(rpm: number) {
    return Math.round(rpm * 60 * calcHours);
  }

  async function submit() {
    setError('');
    setSuccess('');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.employeeId) return setError(`Nhân viên ${i + 1}: chưa chọn tên`);
      if (r.checkedMachineIds.length === 0) return setError(`Nhân viên ${i + 1}: chưa chọn máy nào`);
    }
    const items: Array<{
      employee_id: string; equipment_id: string;
      item_code: string; item_name: string | null; planned_quantity: number;
    }> = [];
    for (const row of rows) {
      for (const machineId of row.checkedMachineIds) {
        const machine = machines.find((m) => m.id === machineId)!;
        const firstItem = machine.items[0];
        if (!firstItem) continue;
        items.push({
          employee_id: row.employeeId,
          equipment_id: machineId,
          item_code: firstItem.item_code,
          item_name: firstItem.item_name,
          planned_quantity: plannedQty(machine.rpm),
        });
      }
    }
    if (items.length === 0) return setError('Không có dòng nào hợp lệ');
    setSubmitting(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overtime_date: date, day_type: dayType, items }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Không gửi được phiếu'); return; }
      setSuccess(`Đã gửi phiếu với ${data.items_count} dòng. (ID: ${data.id.slice(0, 8)}…)`);
      setRows([emptyRow()]);
      loadMyRegs();
    } finally { setSubmitting(false); }
  }

  const noPlan = !loadingOpts && machines.length === 0;

  return (
    <div className="space-y-5">
      {/* Date & day type */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-1.5">Ngày tăng ca</label>
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
          <p className="text-xs text-brand-navy-soft mt-1.5">{timeLabel}</p>
        </div>
      </div>

      {loadingOpts && (
        <p className="text-sm text-brand-navy-soft text-center py-4">Đang tải dữ liệu...</p>
      )}

      {noPlan && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-md">
          Ngày <strong>{date}</strong> chưa có kế hoạch sản xuất. Liên hệ admin upload kế hoạch trước.
        </div>
      )}

      {!loadingOpts && machines.length > 0 && (
        <>
          <div className="space-y-4">
            {rows.map((row, idx) => {
              // Máy đã được nhân viên khác trong cùng phiếu chọn → ẩn khỏi danh sách
              const usedByOthers = new Set<string>();
              rows.forEach((r, i) => {
                if (i !== idx) r.checkedMachineIds.forEach((id) => usedByOthers.add(id));
              });
              const visibleMachines = machines.filter((m) => !usedByOthers.has(m.id));
              return (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-4"
              >
                {/* Row header */}
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

                {/* Employee select */}
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

                {/* Machine checkboxes */}
                <div>
                  <label className="block text-xs font-semibold text-brand-navy mb-2">
                    Chọn máy{' '}
                    {row.checkedMachineIds.length > 0 && (
                      <span className="text-brand-teal font-semibold">
                        ({row.checkedMachineIds.length} máy)
                      </span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {visibleMachines.map((machine) => {
                      const checked = row.checkedMachineIds.includes(machine.id);
                      const itemCode = machine.items[0]?.item_code ?? '—';
                      const qty = plannedQty(machine.rpm);
                      return (
                        <button
                          key={machine.id}
                          type="button"
                          onClick={() => toggleMachine(idx, machine.id)}
                          className={`text-left p-2.5 rounded-lg border-2 transition ${
                            checked
                              ? 'bg-brand-teal/10 border-brand-teal'
                              : 'bg-gray-50 border-gray-200 hover:border-brand-teal/40'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {/* Custom checkbox */}
                            <div
                              className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition ${
                                checked
                                  ? 'bg-brand-teal border-brand-teal'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {checked && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                                  <path
                                    d="M1 4l3 3 5-6"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-brand-navy leading-tight">
                                {machine.code}
                              </div>
                              <div className="text-xs text-brand-teal font-medium mt-0.5 truncate">
                                {itemCode}
                              </div>
                              <div className="text-xs text-brand-navy-soft">
                                {qty.toLocaleString('vi-VN')} pcs
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              );
            })}
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

      {!loadingOpts && machines.length > 0 && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="w-full bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-md transition shadow-md shadow-brand-teal/30"
        >
          {submitting ? 'Đang gửi...' : `Gửi phiếu (${totalItems} dòng) • Bộ phận ${department}`}
        </button>
      )}

      {/* My registrations */}
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
