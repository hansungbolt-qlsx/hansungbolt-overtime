'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toTitleCase } from '@/lib/format';
import DateButton from './DateButton';
import { deptNeedsManualRpm } from '@/lib/departments';
import { CO_ITEMS_DATALIST_ID, findCoItem } from '@/lib/co-items';
import { CoItemsDatalist } from './CoCodes';
import {
  dayTypeMismatch, hasPerPersonHours, isSundayISO, nextSundayISO, normShift, presetOf, presetText, qtyHoursOf,
  shiftLabel, type Shift,
} from '@/lib/overtime-shift';
import ShiftPicker from './ShiftPicker';
import EmployeeSelect from './EmployeeSelect';
import { datDangNhapDo } from '@/lib/dang-nhap-do';
import HoursPicker, {
  DEFAULT_HOURS, HOURS_RULE_TEXT, hoursOf, theoNhanVien1, type HoursChoice,
} from './HoursPicker';

type Employee = { id: string; full_name: string; order_no: number };
// Phiếu đã có của bộ phận trong ngày (API /api/registrations/department — tổ trưởng chỉ thấy bộ phận mình)
type PhieuDaCo = {
  id: string; day_type: string; shift?: string | null; created_at: string;
  items_count: number; registered_by_name: string | null;
};
type PlanItem = { item_code: string; item_name: string | null };
type Machine = { id: string; code: string; rpm: number; spec: string; items: PlanItem[] };

type EmployeeRow = {
  employeeId: string;
  checkedMachineIds: string[];
  // Mã hàng nhập tay cho máy không có trong kế hoạch (RL luôn, HD chỉ khi không có plan item)
  machineItemCodes: Record<string, string>;
  // RPM nhập tay theo máy — chỉ bộ phận CO (Coating, anh Hữu 05/10/2026: RPM theo mã hàng, master để 0)
  machineRpm: Record<string, string>;
  useOther: boolean;
  otherTask: string;
  // Số giờ tăng ca chiều của người này (anh Hữu 04/11/2026) — chỉ dùng khi ngày thường + PM
  hours: HoursChoice;
  // Tổ trưởng đã tự bấm giờ cho ô này chưa. Chưa bấm → giờ đi theo Nhân viên 1 (xem theoNhanVien1)
  hoursTouched: boolean;
};

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const emptyRow = (): EmployeeRow => ({
  employeeId: '',
  checkedMachineIds: [],
  machineItemCodes: {},
  machineRpm: {},
  useOther: false,
  otherTask: '',
  hours: DEFAULT_HOURS,
  hoursTouched: false,
});


// Màu chữ mã máy theo nhóm prefix — giúp dễ phân biệt RL/SM/CT/HD
function machineCodeColor(code: string): string {
  const prefix = code.split('-')[0]?.toUpperCase();
  switch (prefix) {
    case 'HD': return 'text-[#063882]'; // navy
    case 'RL': return 'text-[#0c6c3d]'; // green
    case 'SM': return 'text-[#7c3aed]'; // purple
    case 'CT': return 'text-[#dc2626]'; // red
    default: return 'text-brand-navy';
  }
}

// yyyy-mm-dd → dd/mm/yyyy cho dòng báo ngày KHSX đang dùng
const fmtDateVN = (iso: string) => iso.split('-').reverse().join('/');

export default function OvertimeForm({ department }: { department: string }) {
  const [date, setDate] = useState(todayISO());
  // Mặc định null — form chọn NV/máy ẩn; user phải click 1 nút loại ngày trước.
  const [dayType, setDayType] = useState<'weekday' | 'sunday' | null>(null);
  // Ca ngày thường: mặc định PM, AM = tăng ca sáng 06:00–07:30 (anh Hữu 21/10/2026)
  const [shift, setShift] = useState<Shift>('PM');
  // Ngày trước khi bấm "Chủ nhật" tự nhảy sang Chủ nhật kế tiếp (anh Hữu 31/10/2026) —
  // bỏ chọn Chủ nhật / chọn Ngày thường thì trả về ngày này. Tự đổi ngày bằng lịch → bỏ nhớ.
  const [dateBeforeSunday, setDateBeforeSunday] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  // Ngày KHSX máy chủ thực dùng (khác `date` = đang dùng bản cũ sau cùng, anh Hữu 25/09)
  const [planDateUsed, setPlanDateUsed] = useState<string | null>(null);
  const [rows, setRows] = useState<EmployeeRow[]>([emptyRow()]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Phiếu đã gửi trong ngày đang chọn của bộ phận này (anh Hữu 04/11/2026): trùng ca → báo ngay từ đầu
  const [phieuDaCo, setPhieuDaCo] = useState<{ date: string; list: PhieuDaCo[] } | null>(null);
  const [dangXoaCu, setDangXoaCu] = useState(false);
  // Phiếu vừa gửi xong từ form này → không báo đỏ "đã có phiếu", chỉ báo đã gửi + nút Sửa
  const [vuaGuiId, setVuaGuiId] = useState<string | null>(null);

  // Giờ tính sản lượng (trừ break) — KHÁC giờ hiển thị. Khi dayType=null,
  // form NV/máy bị ẩn nên giá trị này không hiển thị; dùng 0 cho an toàn.
  const preset = dayType ? presetOf(dayType, shift) : null;
  const calcHours = preset ? qtyHoursOf(preset.duration_hours, dayType === 'sunday' ? 'PM' : shift) : 0;
  const manualRpm = deptNeedsManualRpm(department);
  // Ngày thường + ca chiều: mỗi người chọn 3h / 4h / Khác (anh Hữu 04/11/2026)
  const perPerson = hasPerPersonHours(dayType, shift);
  // Giờ tính sản lượng của MỘT người: ca chiều theo số giờ người đó chọn (vẫn trừ 0,5h nghỉ)
  const calcHoursOf = (row: EmployeeRow) =>
    perPerson ? qtyHoursOf(hoursOf(row.hours) ?? 0, 'PM') : calcHours;
  const totalItems = rows.reduce(
    (sum, row) => sum + row.checkedMachineIds.length + (row.useOther ? 1 : 0),
    0,
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingOpts(true);
    setError('');
    setRows([emptyRow()]);
    fetch(`/api/register/options?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) { setError(d.error); setEmployees([]); setMachines([]); setPlanDateUsed(null); return; }
        setEmployees(d.employees ?? []);
        setMachines(d.machines ?? []);
        setPlanDateUsed(d.plan_date_used ?? null);
      })
      .catch(() => !cancelled && setError('Không tải được dữ liệu'))
      .finally(() => !cancelled && setLoadingOpts(false));
    return () => { cancelled = true; };
  }, [date]);

  // Đang nhập dở (đã chọn tên / máy / Công việc khác) → TaiBanMoi không tự tải lại trang
  const dangNhapDo = rows.some((r) => r.employeeId !== '' || r.checkedMachineIds.length > 0 || r.useOther);
  useEffect(() => {
    datDangNhapDo('dang-ky-tang-ca', dangNhapDo);
    return () => datDangNhapDo('dang-ky-tang-ca', false);
  }, [dangNhapDo]);

  // Tải danh sách phiếu đã gửi của bộ phận cho ngày đang chọn. Tải lại khi: đổi ngày, vừa gửi/xóa phiếu,
  // quay lại màn hình (tổ trưởng có thể xóa phiếu ở máy khác).
  const taiPhieuDaCo = useCallback(async (ngay: string) => {
    try {
      const res = await fetch(`/api/registrations/department?date=${ngay}`, { cache: 'no-store' });
      const d = await res.json();
      if (res.ok) setPhieuDaCo({ date: ngay, list: d.registrations ?? [] });
    } catch { /* lỗi mạng: không báo trước được, máy chủ vẫn chặn phiếu trùng lúc gửi */ }
  }, []);
  useEffect(() => {
    let huy = false;
    const tai = () => { if (!huy) taiPhieuDaCo(date); };
    tai();
    const khiHien = () => { if (document.visibilityState === 'visible') tai(); };
    window.addEventListener('overtime:registered', tai);
    window.addEventListener('overtime:deleted', tai);
    document.addEventListener('visibilitychange', khiHien);
    return () => {
      huy = true;
      window.removeEventListener('overtime:registered', tai);
      window.removeEventListener('overtime:deleted', tai);
      document.removeEventListener('visibilitychange', khiHien);
    };
  }, [date, taiPhieuDaCo]);
  // Phiếu cùng ca đã có (cùng luật chặn của máy chủ: một bộ phận một ngày một phiếu mỗi ca)
  const phieuTrung = dayType && phieuDaCo?.date === date
    ? phieuDaCo.list.find((r) => normShift(r.day_type, r.shift) === normShift(dayType, shift)) ?? null
    : null;

  async function xoaPhieuCu(id: string) {
    if (!window.confirm('Xóa phiếu cũ này? Thao tác không thể khôi phục.')) return;
    setDangXoaCu(true);
    try {
      const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(`Xóa thất bại: ${data.error ?? res.statusText}`);
        return;
      }
      // Báo danh sách phiếu bên dưới + chính form này tải lại
      window.dispatchEvent(new CustomEvent('overtime:deleted', { detail: { id } }));
    } finally { setDangXoaCu(false); }
  }

  function toggleMachine(rowIdx: number, machineId: string) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      const already = row.checkedMachineIds.includes(machineId);
      next[rowIdx] = {
        ...row,
        // Chọn máy thật → tự tắt chế độ "Công việc khác"
        useOther: false,
        otherTask: '',
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
        // Bật "Công việc khác" → xóa máy đã chọn (tách biệt)
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

  function updateMachineItemCode(rowIdx: number, machineId: string, value: string) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      next[rowIdx] = {
        ...row,
        machineItemCodes: { ...row.machineItemCodes, [machineId]: value },
        // CO (anh Hữu 05/10/2026): mã có trong danh sách Coating → RPM tự điền (sửa tay vẫn được)
        ...(manualRpm && findCoItem(value)
          ? { machineRpm: { ...row.machineRpm, [machineId]: String(findCoItem(value)!.rpm) } }
          : {}),
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

  function updateHours(rowIdx: number, hours: HoursChoice) {
    setRows((prev) => {
      if (rowIdx === 0) {
        // Đổi giờ Nhân viên 1 → các ô sau chưa tự bấm đi theo
        const mau = theoNhanVien1(hours);
        return prev.map((r, i) =>
          i === 0 ? { ...r, hours } : r.hoursTouched ? r : { ...r, hours: mau });
      }
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], hours, hoursTouched: true };
      return next;
    });
  }

  function updateMachineRpm(rowIdx: number, machineId: string, value: string) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      next[rowIdx] = { ...row, machineRpm: { ...row.machineRpm, [machineId]: value } };
      return next;
    });
  }

  // RPM dùng tính SL dự kiến: CO lấy số nhập tay, bộ phận khác lấy RPM master của máy
  function rpmOf(row: EmployeeRow, machine: Machine): number {
    if (!manualRpm) return machine.rpm;
    const v = parseInt(row.machineRpm[machine.id] ?? '', 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow(), hours: theoNhanVien1(prev[0]?.hours) }]);
  }
  function removeRow(idx: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function plannedQty(rpm: number, row: EmployeeRow) {
    return Math.round(rpm * 60 * calcHoursOf(row));
  }

  async function submit() {
    setError('');
    setSuccess('');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.employeeId) return setError(`Nhân viên ${i + 1}: chưa chọn tên`);
      if (perPerson && hoursOf(r.hours) == null)
        return setError(`Nhân viên ${i + 1}: số giờ "Khác" chưa đúng (${HOURS_RULE_TEXT})`);
      if (r.useOther) {
        if (!r.otherTask.trim())
          return setError(`Nhân viên ${i + 1}: chưa nhập nội dung Công việc khác`);
      } else if (r.checkedMachineIds.length === 0) {
        return setError(`Nhân viên ${i + 1}: chưa chọn máy hoặc Công việc khác`);
      } else {
        for (const mId of r.checkedMachineIds) {
          const m = machines.find((mm) => mm.id === mId);
          if (!m) continue;
          if (!m.items[0] && !r.machineItemCodes[mId]?.trim()) {
            return setError(`Nhân viên ${i + 1}: máy ${m.code} chưa nhập mã hàng`);
          }
          if (manualRpm && rpmOf(r, m) <= 0) {
            return setError(`Nhân viên ${i + 1}: máy ${m.code} chưa nhập RPM`);
          }
        }
      }
    }
    // Một người nằm ở 2 ô (máy + Công việc khác) thì phải cùng số giờ — phiếu in một người một giờ
    if (perPerson) {
      const gioCuaNguoi = new Map<string, number>();
      for (let i = 0; i < rows.length; i++) {
        const h = hoursOf(rows[i].hours)!;
        const truoc = gioCuaNguoi.get(rows[i].employeeId);
        if (truoc != null && truoc !== h) {
          const ten = employees.find((e) => e.id === rows[i].employeeId)?.full_name ?? '';
          return setError(`Nhân viên ${i + 1} (${toTitleCase(ten)}): chọn số giờ khác với ô trước của cùng người — chọn lại cho giống nhau`);
        }
        gioCuaNguoi.set(rows[i].employeeId, h);
      }
    }
    const items: Array<{
      employee_id: string;
      duration_hours?: number;
      equipment_id?: string;
      item_code?: string;
      item_name?: string | null;
      planned_quantity?: number;
      is_other?: boolean;
      other_description?: string;
    }> = [];
    for (const row of rows) {
      if (row.useOther) {
        items.push({
          employee_id: row.employeeId,
          ...(perPerson ? { duration_hours: hoursOf(row.hours)! } : {}),
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
          employee_id: row.employeeId,
          ...(perPerson ? { duration_hours: hoursOf(row.hours)! } : {}),
          equipment_id: machineId,
          item_code: itemCode,
          item_name: planItem?.item_name ?? null,
          planned_quantity: plannedQty(rpmOf(row, machine), row),
        });
      }
    }
    if (items.length === 0) return setError('Không có dòng nào hợp lệ');
    if (!dayType) return setError('Chưa chọn loại ngày');
    const lech = dayTypeMismatch(date, dayType);
    if (lech && !window.confirm(`${lech}
Vẫn gửi phiếu?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overtime_date: date, day_type: dayType, shift, items }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Không gửi được phiếu'); return; }
      setSuccess(`Đã gửi phiếu với ${data.items_count} dòng. (ID: ${data.id.slice(0, 8)}…)`);
      setVuaGuiId(data.id);
      setRows([emptyRow()]);
      // Báo DepartmentRegistrationsList tự refetch (không cần user reload trang)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('overtime:registered', { detail: { date } }),
        );
      }
    } finally { setSubmitting(false); }
  }

  const noPlan = !loadingOpts && machines.length === 0;
  const lechNgay = dayTypeMismatch(date, dayType);

  // Bấm nút loại ngày: Chủ nhật → ngày tự nhảy sang Chủ nhật kế tiếp gần nhất (anh Hữu 31/10/2026)
  function chooseDayType(type: 'weekday' | 'sunday') {
    if (dayType === type) {
      // Bấm lại nút đang chọn → thu gọn; Chủ nhật đã tự nhảy ngày → trả ngày cũ
      setDayType(null);
      if (dateBeforeSunday) { setDate(dateBeforeSunday); setDateBeforeSunday(null); }
      return;
    }
    setDayType(type);
    setShift('PM'); // mỗi lần chọn lại loại ngày → về mặc định PM
    if (type === 'sunday' && !isSundayISO(date)) {
      setDateBeforeSunday(date);
      setDate(nextSundayISO(date));
    } else if (type === 'weekday' && dateBeforeSunday) {
      setDate(dateBeforeSunday);
      setDateBeforeSunday(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Date & day type */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-1.5">Ngày tăng ca</label>
          <DateButton
            value={date}
            onChange={(v) => { if (v) { setDate(v); setDateBeforeSunday(null); } }}
            className="w-full justify-start"
          />
        </div>
        <div>
          <span className="block text-sm font-semibold text-brand-navy mb-1.5">Loại ngày</span>
          <div className="grid grid-cols-2 gap-2">
            {(['weekday', 'sunday'] as const).map((type) => {
              const isActive = dayType === type;
              const timeText = presetText(presetOf(type, shift));
              return (
                <div key={type} className="flex flex-col gap-1">
                  <button
                    type="button"
                    // Click nút đang active -> thu gọn (dayType=null); click nút khác -> switch
                    onClick={() => chooseDayType(type)}
                    className={`py-2.5 rounded-md border text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-teal text-white border-brand-teal'
                        : 'bg-white text-brand-navy border-gray-300 hover:border-brand-teal'
                    }`}
                  >
                    {type === 'weekday' ? 'Ngày thường' : 'Chủ nhật'}
                  </button>
                  {isActive && type === 'sunday' && (
                    <p className="text-xs text-brand-navy-soft text-center">
                      {timeText}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {dayType === 'weekday' && <ShiftPicker value={shift} onChange={setShift} pmGioRieng />}
          {perPerson && (
            <p className="text-xs mt-1.5 text-brand-navy-soft">
              Chọn 3h / 4h / Khác cho từng người ở ô bên phải &quot;Nhân viên&quot;.
            </p>
          )}
          {dayType === 'sunday' && !lechNgay && (
            <p className="text-sm mt-1.5 text-brand-navy font-semibold text-center">
              Ngày tăng ca: Chủ nhật {fmtDateVN(date)}
            </p>
          )}
          {lechNgay && (
            <p className="text-sm mt-1.5 text-red-700 bg-red-50 border border-red-200 rounded-md p-2 font-medium">
              ⚠ {lechNgay} Kiểm tra lại ô Ngày tăng ca.
            </p>
          )}
          {!dayType && (
            <p className="text-xs mt-1.5 text-brand-teal font-medium">
              Chọn loại ngày để bắt đầu thêm nhân viên
            </p>
          )}
        </div>
      </div>

      {/* Đã có phiếu cùng ca trong ngày → báo ngay, ẩn phần nhập (anh Hữu 04/11/2026) */}
      {phieuTrung && phieuTrung.id === vuaGuiId && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-green-800">
            Đã gửi phiếu {shiftLabel(phieuTrung.day_type, phieuTrung.shift)} ngày {fmtDateVN(date)} ({phieuTrung.items_count} dòng).
            Cần đổi người, máy hoặc số giờ thì bấm Sửa phiếu.
          </p>
          <Link
            href={`/dashboard/registrations/${phieuTrung.id}/edit`}
            className="block text-center bg-[#f59e0b] hover:bg-[#d97706] text-white text-sm font-semibold py-2.5 rounded-md transition"
          >
            Sửa phiếu
          </Link>
        </div>
      )}
      {phieuTrung && phieuTrung.id !== vuaGuiId && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-red-700">
            ⚠ Ngày {fmtDateVN(date)} bộ phận {department} đã có phiếu {shiftLabel(phieuTrung.day_type, phieuTrung.shift)}
          </p>
          <p className="text-sm text-red-800">
            Phiếu gửi lúc {new Date(phieuTrung.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            {phieuTrung.registered_by_name ? ` bởi ${toTitleCase(phieuTrung.registered_by_name)}` : ''}
            {' '}({phieuTrung.items_count} dòng). Mỗi ca chỉ được một phiếu nên không gửi thêm phiếu mới được.
          </p>
          <ul className="text-sm text-red-800 list-disc pl-5 space-y-0.5">
            <li>Đổi người, máy hoặc số giờ: bấm <strong>Sửa phiếu cũ</strong>.</li>
            <li>Làm lại từ đầu: bấm <strong>Xóa phiếu cũ</strong> rồi đăng ký lại.</li>
          </ul>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/registrations/${phieuTrung.id}/edit`}
              className="flex-1 text-center bg-[#f59e0b] hover:bg-[#d97706] text-white text-sm font-semibold py-2.5 rounded-md transition"
            >
              Sửa phiếu cũ
            </Link>
            <button
              type="button"
              onClick={() => xoaPhieuCu(phieuTrung.id)}
              disabled={dangXoaCu}
              className="flex-1 bg-white hover:bg-red-50 border border-red-400 text-red-600 text-sm font-semibold py-2.5 rounded-md transition disabled:opacity-60"
            >
              {dangXoaCu ? 'Đang xóa...' : 'Xóa phiếu cũ'}
            </button>
          </div>
        </div>
      )}

      {loadingOpts && (
        <p className="text-sm text-brand-navy-soft text-center py-4">Đang tải dữ liệu...</p>
      )}

      {noPlan && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-md">
          {department === 'HD' ? (
            <>
              Chưa có kế hoạch sản xuất nào tính đến ngày <strong>{fmtDateVN(date)}</strong>.
              Liên hệ admin upload kế hoạch trước.
            </>
          ) : (
            <>Chưa có máy nào khả dụng cho bộ phận {department}.</>
          )}
        </div>
      )}

      {!loadingOpts && department === 'HD' && planDateUsed && planDateUsed !== date && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-md">
          Ngày <strong>{fmtDateVN(date)}</strong> chưa có kế hoạch sản xuất mới — đang dùng
          kế hoạch <strong>ngày {fmtDateVN(planDateUsed)}</strong> (bản sau cùng).
        </div>
      )}

      {manualRpm && (
        <CoItemsDatalist />
      )}
      {!loadingOpts && machines.length > 0 && dayType && !phieuTrung && (
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
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 pt-1">
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
                  {/* Số giờ tăng ca chiều của người này (anh Hữu 04/11/2026) */}
                  {perPerson && (
                    <HoursPicker value={row.hours} onChange={(v) => updateHours(idx, v)} />
                  )}
                </div>

                {/* Employee select */}
                <div>
                  <label className="block text-xs font-semibold text-brand-navy mb-1">
                    Tên nhân viên
                  </label>
                  <EmployeeSelect
                    value={row.employeeId}
                    employees={employees}
                    onChange={(v) => updateEmployee(idx, v)}
                  />
                </div>

                {/* Machine checkboxes */}
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
                    <div className={`grid grid-cols-2 gap-1.5 ${row.useOther ? 'opacity-50' : ''}`}>
                      {visibleMachines.map((machine) => {
                        const checked = row.checkedMachineIds.includes(machine.id);
                        const planItem = machine.items[0];
                        const needsManualCode = !planItem;
                        const itemCodeLabel = planItem?.item_code ?? '—';
                        const qty = plannedQty(rpmOf(row, machine), row);
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
                                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 10 8">
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
                                    updateMachineItemCode(idx, machine.id, e.target.value)
                                  }
                                  placeholder={manualRpm ? "Gõ mã hàng — chọn gợi ý để tự điền RPM" : "Nhập mã hàng"}
                                  list={manualRpm ? CO_ITEMS_DATALIST_ID : undefined}
                                  autoComplete="off"
                                  className="w-full px-2 py-1 text-base border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-teal bg-white"
                                />
                              </div>
                            )}
                            {checked && manualRpm && (
                              <div className="px-2 pb-1.5 flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-brand-navy whitespace-nowrap">RPM</span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  value={row.machineRpm[machine.id] ?? ''}
                                  onChange={(e) => updateMachineRpm(idx, machine.id, e.target.value)}
                                  placeholder="Nhập RPM"
                                  className="w-full px-2 py-1 text-base border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-amber-50"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Công việc khác — full-width, cuối danh sách, màu cam phân biệt với máy */}
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
                              <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 10 8">
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
      {success && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-md">
          {success}
        </div>
      )}

      {!loadingOpts && machines.length > 0 && dayType && !phieuTrung && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="w-full bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-md transition shadow-md shadow-brand-teal/30"
        >
          {submitting
            ? 'Đang gửi...'
            : `Gửi phiếu ${dayType === 'weekday' ? shift + ' ' : ''}(${totalItems} dòng) • Bộ phận ${department}`}
        </button>
      )}
    </div>
  );
}
