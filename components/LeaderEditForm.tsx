'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toTitleCase } from '@/lib/format';

type Employee = { id: string; full_name: string; order_no: number };
type PlanItem = { item_code: string; item_name: string | null };
type Machine = {
  id: string;
  code: string;
  rpm: number;
  spec: string;
  items: PlanItem[];
};
type Equipment = { id: string; code: string; machine_type: string };

type InitialItem = {
  id: string;
  employee_id: string;
  equipment_id: string;
  item_code: string;
};

type EmployeeRow = {
  employeeId: string;
  checkedMachineIds: string[];
  machineItemCodes: Record<string, string>;
  // Map equipment_id -> overtime_items.id (existing). Khi submit lookup id.
  existingItemIds: Record<string, string>;
  useOther: boolean;
  otherTask: string;
  otherItemId: string | null;
};

const emptyRow = (): EmployeeRow => ({
  employeeId: '',
  checkedMachineIds: [],
  machineItemCodes: {},
  existingItemIds: {},
  useOther: false,
  otherTask: '',
  otherItemId: null,
});

function machineCodeColor(code: string): string {
  const prefix = code.split('-')[0]?.toUpperCase();
  switch (prefix) {
    case 'HD': return 'text-[#063882]';
    case 'RL': return 'text-[#0c6c3d]';
    case 'SM': return 'text-[#7c3aed]';
    case 'CT': return 'text-[#dc2626]';
    default: return 'text-brand-navy';
  }
}

// Khi load phiếu cũ, biết được equipment nào là OTHER từ equipments table (machine_type='OTHER').
// Pass list equipments của phiếu xuống để check.
function itemsToRows(
  items: InitialItem[],
  otherEquipmentIds: Set<string>,
): EmployeeRow[] {
  const byEmp = new Map<string, InitialItem[]>();
  for (const it of items) {
    if (!byEmp.has(it.employee_id)) byEmp.set(it.employee_id, []);
    byEmp.get(it.employee_id)!.push(it);
  }
  const rows: EmployeeRow[] = [];
  for (const [empId, empItems] of byEmp) {
    const otherItem = empItems.find((it) => otherEquipmentIds.has(it.equipment_id));
    const machineItems = empItems.filter(
      (it) => !otherEquipmentIds.has(it.equipment_id),
    );
    if (machineItems.length > 0) {
      rows.push({
        employeeId: empId,
        checkedMachineIds: machineItems.map((i) => i.equipment_id),
        machineItemCodes: Object.fromEntries(
          machineItems.map((i) => [i.equipment_id, i.item_code]),
        ),
        existingItemIds: Object.fromEntries(
          machineItems.map((i) => [i.equipment_id, i.id]),
        ),
        useOther: false,
        otherTask: '',
        otherItemId: null,
      });
    }
    if (otherItem) {
      rows.push({
        employeeId: empId,
        checkedMachineIds: [],
        machineItemCodes: {},
        existingItemIds: {},
        useOther: true,
        otherTask: otherItem.item_code,
        otherItemId: otherItem.id,
      });
    }
  }
  return rows;
}

export default function LeaderEditForm({
  registrationId,
  department,
  initialDate,
  initialDayType,
  initialItems,
  equipments,
  backHref,
}: {
  registrationId: string;
  department: string;
  initialDate: string;
  initialDayType: 'weekday' | 'sunday';
  initialItems: InitialItem[];
  equipments: Equipment[];
  backHref: string;
}) {
  const router = useRouter();
  const [dayType, setDayType] = useState<'weekday' | 'sunday'>(initialDayType);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rows, setRows] = useState<EmployeeRow[]>([emptyRow()]);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rowsInit, setRowsInit] = useState(false);

  const otherEquipmentIds = new Set(
    equipments.filter((e) => e.machine_type === 'OTHER').map((e) => e.id),
  );

  const calcHours = dayType === 'weekday' ? 2.5 : 7.5;
  const timeLabel =
    dayType === 'weekday' ? '16:30 – 19:30 (3 giờ)' : '06:00 – 14:00 (8 giờ)';
  const totalItems = rows.reduce(
    (sum, row) => sum + row.checkedMachineIds.length + (row.useOther ? 1 : 0),
    0,
  );

  // Load options 1 lần khi mount (date không đổi trong edit)
  useEffect(() => {
    let cancelled = false;
    setLoadingOpts(true);
    setError('');
    fetch(`/api/register/options?date=${initialDate}`)
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
        if (!rowsInit) {
          const initRows = itemsToRows(initialItems, otherEquipmentIds);
          setRows(initRows.length > 0 ? initRows : [emptyRow()]);
          setRowsInit(true);
        }
      })
      .catch(() => !cancelled && setError('Không tải được dữ liệu'))
      .finally(() => !cancelled && setLoadingOpts(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDate]);

  function toggleMachine(rowIdx: number, machineId: string) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      const already = row.checkedMachineIds.includes(machineId);
      next[rowIdx] = {
        ...row,
        useOther: false,
        otherTask: '',
        otherItemId: row.otherItemId,
        checkedMachineIds: already
          ? row.checkedMachineIds.filter((id) => id !== machineId)
          : [...row.checkedMachineIds, machineId],
      };
      return next;
    });
  }

  function toggleOther(rowIdx: number) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      const turningOn = !row.useOther;
      next[rowIdx] = {
        ...row,
        useOther: turningOn,
        otherTask: turningOn ? row.otherTask : '',
        checkedMachineIds: turningOn ? [] : row.checkedMachineIds,
      };
      return next;
    });
  }

  function updateOtherTask(rowIdx: number, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], otherTask: value };
      return next;
    });
  }

  function updateMachineItemCode(
    rowIdx: number,
    machineId: string,
    value: string,
  ) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      next[rowIdx] = {
        ...row,
        machineItemCodes: { ...row.machineItemCodes, [machineId]: value },
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

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function plannedQty(rpm: number) {
    return Math.round(rpm * 60 * calcHours);
  }

  async function submit() {
    setError('');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.employeeId)
        return setError(`Nhân viên ${i + 1}: chưa chọn tên`);
      if (r.useOther) {
        if (!r.otherTask.trim())
          return setError(
            `Nhân viên ${i + 1}: chưa nhập nội dung Công việc khác`,
          );
      } else if (r.checkedMachineIds.length === 0) {
        return setError(
          `Nhân viên ${i + 1}: chưa chọn máy hoặc Công việc khác`,
        );
      } else {
        for (const mId of r.checkedMachineIds) {
          const m = machines.find((mm) => mm.id === mId);
          if (!m) continue;
          if (!m.items[0] && !r.machineItemCodes[mId]?.trim()) {
            return setError(
              `Nhân viên ${i + 1}: máy ${m.code} chưa nhập mã hàng`,
            );
          }
        }
      }
    }

    // Build PATCH items[]
    const items: Array<{
      id?: string;
      employee_id: string;
      equipment_id?: string;
      item_code?: string;
      item_name?: string | null;
      is_other?: boolean;
      other_description?: string;
    }> = [];

    for (const row of rows) {
      if (row.useOther) {
        items.push({
          id: row.otherItemId ?? undefined,
          employee_id: row.employeeId,
          is_other: true,
          other_description: row.otherTask.trim(),
        });
        continue;
      }
      for (const machineId of row.checkedMachineIds) {
        const machine = machines.find((m) => m.id === machineId)!;
        const planItem = machine.items[0];
        const typedCode = (row.machineItemCodes[machineId] ?? '').trim();
        const itemCode = planItem?.item_code ?? typedCode;
        if (!itemCode) continue;
        items.push({
          id: row.existingItemIds[machineId] ?? undefined,
          employee_id: row.employeeId,
          equipment_id: machineId,
          item_code: itemCode,
          item_name: planItem?.item_name ?? null,
        });
      }
    }

    if (items.length === 0) return setError('Không có dòng nào hợp lệ');

    setSubmitting(true);
    try {
      const res = await fetch(`/api/registrations/${registrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_type: dayType, items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Không lưu được phiếu');
        return;
      }
      router.push(backHref);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const noPlan = !loadingOpts && machines.length === 0;
  const [yy, mm, dd] = initialDate.split('-');
  const dateLabel = `${dd}/${mm}/${yy}`;

  return (
    <div className="space-y-5">
      {/* Header: title + back */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-navy">
            Sửa phiếu — Bộ phận {department}
          </h1>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Ngày {dateLabel} • {dayType === 'weekday' ? 'Ngày thường' : 'Chủ nhật'}
          </p>
        </div>
        <Link
          href={backHref}
          className="text-xs text-brand-navy-soft hover:text-brand-navy px-3 py-1.5 border border-brand-surface-alt rounded-md"
        >
          ← Hủy
        </Link>
      </div>

      {/* Day type readonly (chuyển giữa weekday/sunday) */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-4">
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
          <p className="text-xs text-brand-navy-soft mt-1.5">{timeLabel}</p>
        </div>
      </div>

      {loadingOpts && (
        <p className="text-sm text-brand-navy-soft text-center py-4">
          Đang tải dữ liệu...
        </p>
      )}

      {noPlan && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-md">
          {department === 'HD' ? (
            <>
              Ngày <strong>{initialDate}</strong> không có kế hoạch sản xuất.
              Liên hệ admin upload kế hoạch trước.
            </>
          ) : (
            <>Chưa có máy nào khả dụng cho bộ phận {department}.</>
          )}
        </div>
      )}

      {!loadingOpts && machines.length > 0 && (
        <>
          <div className="space-y-4">
            {rows.map((row, idx) => {
              const usedByOthers = new Set<string>();
              rows.forEach((r, i) => {
                if (i !== idx)
                  r.checkedMachineIds.forEach((id) => usedByOthers.add(id));
              });
              const visibleMachines = machines.filter(
                (m) => !usedByOthers.has(m.id),
              );
              return (
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-brand-navy">
                        Chọn máy{' '}
                        {row.checkedMachineIds.length > 0 && (
                          <span className="text-brand-teal font-semibold">
                            ({row.checkedMachineIds.length} máy)
                          </span>
                        )}
                      </label>
                      <span className="text-[10px] text-brand-navy-soft">
                        {visibleMachines.length} máy khả dụng
                      </span>
                    </div>
                    <div className="max-h-[220px] overflow-y-auto border border-brand-surface-alt rounded-lg p-1.5 bg-brand-surface/40">
                      <div
                        className={`grid grid-cols-2 gap-1.5 ${row.useOther ? 'opacity-50' : ''}`}
                      >
                        {visibleMachines.map((machine) => {
                          const checked = row.checkedMachineIds.includes(machine.id);
                          const planItem = machine.items[0];
                          const needsManualCode = !planItem;
                          const itemCodeLabel = planItem?.item_code ?? '—';
                          const qty = plannedQty(machine.rpm);
                          return (
                            <div
                              key={machine.id}
                              className={`rounded-md border transition ${
                                checked
                                  ? 'bg-brand-teal/10 border-brand-teal'
                                  : 'bg-white border-gray-200 hover:border-brand-teal/40'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleMachine(idx, machine.id)}
                                className="w-full text-left px-2 py-1.5"
                              >
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border transition ${
                                      checked
                                        ? 'bg-brand-teal border-brand-teal'
                                        : 'border-gray-300 bg-white'
                                    }`}
                                  >
                                    {checked && (
                                      <svg
                                        className="w-2 h-2 text-white"
                                        fill="none"
                                        viewBox="0 0 10 8"
                                      >
                                        <path
                                          d="M1 4l3 3 5-6"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-1">
                                      <span className={`text-sm font-bold leading-tight ${machineCodeColor(machine.code)}`}>
                                        {machine.code}
                                      </span>
                                      <span className="text-[10px] text-brand-navy-soft leading-tight">
                                        {qty.toLocaleString('vi-VN')}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-brand-teal font-medium truncate leading-tight">
                                      {itemCodeLabel}
                                    </div>
                                  </div>
                                </div>
                              </button>
                              {checked && needsManualCode && (
                                <div className="px-2 pb-1.5">
                                  <input
                                    type="text"
                                    value={row.machineItemCodes[machine.id] ?? ''}
                                    onChange={(e) =>
                                      updateMachineItemCode(
                                        idx,
                                        machine.id,
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Nhập mã hàng"
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-teal bg-white"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => toggleOther(idx)}
                          className={`w-full text-left px-2 py-1.5 rounded-md border transition ${
                            row.useOther
                              ? 'bg-amber-50 border-amber-400'
                              : 'bg-white border-gray-200 hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border transition ${
                                row.useOther
                                  ? 'bg-amber-500 border-amber-500'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {row.useOther && (
                                <svg
                                  className="w-2 h-2 text-white"
                                  fill="none"
                                  viewBox="0 0 10 8"
                                >
                                  <path
                                    d="M1 4l3 3 5-6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm font-bold text-amber-800 leading-tight">
                              Công việc khác
                            </span>
                          </div>
                        </button>
                        {row.useOther && (
                          <input
                            type="text"
                            autoFocus
                            value={row.otherTask}
                            onChange={(e) => updateOtherTask(idx, e.target.value)}
                            placeholder="VD: Vệ sinh máy lạnh"
                            className="mt-1.5 w-full px-3 py-2 border border-amber-300 rounded-md text-brand-navy bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                          />
                        )}
                      </div>
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

      {!loadingOpts && machines.length > 0 && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="w-full bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-md transition shadow-md shadow-brand-teal/30"
        >
          {submitting ? 'Đang lưu...' : `Lưu phiếu (${totalItems} dòng)`}
        </button>
      )}
    </div>
  );
}
