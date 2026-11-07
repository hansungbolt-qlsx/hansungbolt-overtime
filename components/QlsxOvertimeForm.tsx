'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toTitleCase } from '@/lib/format';
import {
  dayTypeMismatch, hasPerPersonHours, isSundayISO, nextSundayISO, normShift, presetOf, presetText,
  shiftLabel, type Shift,
} from '@/lib/overtime-shift';
import { datDangNhapDo } from '@/lib/dang-nhap-do';
import ShiftPicker from './ShiftPicker';
import DateButton from './DateButton';
import EmployeeSelect from './EmployeeSelect';
import HoursPicker, {
  DEFAULT_HOURS, HOURS_RULE_TEXT, hoursOf, theoNhanVien1, type HoursChoice,
} from './HoursPicker';

type Employee = { id: string; full_name: string; order_no: number };

type EmployeeRow = {
  employeeId: string;
  reason: string;
  // Ca chiều ngày thường: số giờ từng người, giống tổ trưởng các bộ phận (anh Hữu 04/11/2026)
  hours: HoursChoice;
  hoursTouched: boolean;   // chưa tự bấm → đi theo Nhân viên 1
};

// Phiếu QLSX đã có trong ngày (API department: admin thấy mọi bộ phận → lọc QLSX)
type PhieuDaCo = {
  id: string; department: string; day_type: string; shift?: string | null; created_at: string;
  items_count: number; registered_by_name: string | null;
};

const emptyRow = (): EmployeeRow => ({ employeeId: '', reason: '', hours: DEFAULT_HOURS, hoursTouched: false });
const fmtDateVN = (iso: string) => iso.split('-').reverse().join('/');

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
  // Ca ngày thường: mặc định PM, AM = tăng ca sáng (anh Hữu 21/10/2026)
  const [shift, setShift] = useState<Shift>('PM');
  // Ngày trước khi bấm "Chủ nhật" tự nhảy sang Chủ nhật kế tiếp (anh Hữu 31/10/2026)
  const [dateBeforeSunday, setDateBeforeSunday] = useState<string | null>(null);
  const [rows, setRows] = useState<EmployeeRow[]>([emptyRow()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [phieuDaCo, setPhieuDaCo] = useState<{ date: string; list: PhieuDaCo[] } | null>(null);
  const [dangXoaCu, setDangXoaCu] = useState(false);
  const [vuaGuiId, setVuaGuiId] = useState<string | null>(null);

  const lechNgay = dayTypeMismatch(date, dayType);
  // Ngày thường + ca chiều: mỗi người chọn 3h / 4h / Khác (giống form tổ trưởng)
  const perPerson = hasPerPersonHours(dayType, shift);

  // Đang nhập dở → TaiBanMoi không tự tải lại trang
  const dangNhapDo = rows.some((r) => r.employeeId !== '' || r.reason.trim() !== '');
  useEffect(() => {
    datDangNhapDo('dang-ky-qlsx', dangNhapDo);
    return () => datDangNhapDo('dang-ky-qlsx', false);
  }, [dangNhapDo]);

  // Phiếu QLSX đã có trong ngày đang chọn → trùng ca thì báo ngay (giống form tổ trưởng)
  const taiPhieuDaCo = useCallback(async (ngay: string) => {
    try {
      const res = await fetch(`/api/registrations/department?date=${ngay}`, { cache: 'no-store' });
      const d = await res.json();
      if (res.ok) {
        setPhieuDaCo({
          date: ngay,
          list: ((d.registrations ?? []) as PhieuDaCo[]).filter((r) => r.department === 'QLSX'),
        });
      }
    } catch { /* lỗi mạng: máy chủ vẫn chặn phiếu trùng lúc gửi */ }
  }, []);
  useEffect(() => {
    let huy = false;
    const tai = () => { if (!huy) taiPhieuDaCo(date); };
    tai();
    const khiHien = () => { if (document.visibilityState === 'visible') tai(); };
    document.addEventListener('visibilitychange', khiHien);
    return () => { huy = true; document.removeEventListener('visibilitychange', khiHien); };
  }, [date, taiPhieuDaCo]);
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
      await taiPhieuDaCo(date);
      router.refresh();
    } finally { setDangXoaCu(false); }
  }

  // Bấm "Chủ nhật" → ngày tự nhảy sang Chủ nhật kế tiếp gần nhất; quay về "Ngày thường" → trả ngày cũ
  function chooseDayType(type: 'weekday' | 'sunday') {
    if (dayType !== type) setShift('PM');
    setDayType(type);
    if (type === 'sunday' && !isSundayISO(date)) {
      setDateBeforeSunday(date);
      setDate(nextSundayISO(date));
    } else if (type === 'weekday' && dateBeforeSunday) {
      setDate(dateBeforeSunday);
      setDateBeforeSunday(null);
    }
  }

  const timeLabel = dayType
    ? presetText(presetOf(dayType, shift))
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

  function updateHours(idx: number, hours: HoursChoice) {
    setRows((prev) => {
      if (idx === 0) {
        // Đổi giờ Nhân viên 1 → các ô sau chưa tự bấm đi theo (4h → 4h; 3h/Khác → 3h)
        const mau = theoNhanVien1(hours);
        return prev.map((r, i) => (i === 0 ? { ...r, hours } : r.hoursTouched ? r : { ...r, hours: mau }));
      }
      const next = [...prev];
      next[idx] = { ...next[idx], hours, hoursTouched: true };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow(), hours: theoNhanVien1(prev[0]?.hours) }]);
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
      if (perPerson && hoursOf(r.hours) == null)
        return setError(`Nhân viên ${i + 1}: số giờ "Khác" chưa đúng (${HOURS_RULE_TEXT})`);
    }
    // Một người nằm ở 2 ô thì phải cùng số giờ
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
    if (lechNgay && !window.confirm(`${lechNgay}
Vẫn gửi phiếu?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/registrations/qlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overtime_date: date,
          day_type: dayType,
          shift,
          items: rows.map((r) => ({
            employee_id: r.employeeId,
            reason: r.reason.trim(),
            ...(perPerson ? { duration_hours: hoursOf(r.hours)! } : {}),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Không gửi được phiếu');
        return;
      }
      setSuccess(`Đã gửi phiếu với ${data.items_count} dòng.`);
      setVuaGuiId(data.id ?? null);
      setRows([emptyRow()]);
      await taiPhieuDaCo(date);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Nhãn + ô ngày cùng 1 hàng (anh Hữu 07/11/2026) — đồng bộ form tổ trưởng */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-brand-navy">Ngày tăng ca</span>
          <DateButton
            value={date}
            onChange={(v) => { if (v) { setDate(v); setDateBeforeSunday(null); } }}
          />
        </div>
        <div>
          <span className="block text-sm font-semibold text-brand-navy mb-1">
            Loại ngày
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(['weekday', 'sunday'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => chooseDayType(type)}
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
          {dayType === 'weekday' ? (
            <>
              <ShiftPicker value={shift} onChange={setShift} pmGioRieng />
              {perPerson && (
                <p className="text-xs mt-1.5 text-brand-navy-soft">
                  Chọn 3h / 4h / Khác cho từng người ở ô bên phải &quot;Nhân viên&quot;.
                </p>
              )}
            </>
          ) : (
            <p
              className={`text-xs mt-1.5 ${dayType ? 'text-brand-navy-soft' : 'text-brand-teal font-medium'}`}
            >
              {dayType === 'sunday' && !lechNgay && (
                <strong className="text-brand-navy">Chủ nhật {date.split('-').reverse().join('/')} · </strong>
              )}
              {timeLabel}
            </p>
          )}
          {lechNgay && (
            <p className="text-sm mt-1.5 text-red-700 bg-red-50 border border-red-200 rounded-md p-2 font-medium">
              ⚠ {lechNgay} Kiểm tra lại ô Ngày tăng ca.
            </p>
          )}
        </div>
        <div className="text-xs text-brand-navy-soft border-t border-brand-surface-alt pt-3">
          Người yêu cầu: <strong className="text-brand-navy">{toTitleCase(defaultRequestor)}</strong>
        </div>
      </div>

      {/* Đã có phiếu QLSX cùng ca trong ngày → báo ngay, ẩn phần nhập (giống form tổ trưởng) */}
      {phieuTrung && phieuTrung.id === vuaGuiId && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-green-800">
            Đã gửi phiếu {shiftLabel(phieuTrung.day_type, phieuTrung.shift)} ngày {fmtDateVN(date)} ({phieuTrung.items_count} dòng).
            Cần đổi người hoặc số giờ thì bấm Sửa phiếu.
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
            ⚠ Ngày {fmtDateVN(date)} bộ phận QLSX đã có phiếu {shiftLabel(phieuTrung.day_type, phieuTrung.shift)}
          </p>
          <p className="text-sm text-red-800">
            Phiếu gửi lúc {new Date(phieuTrung.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            {phieuTrung.registered_by_name ? ` bởi ${toTitleCase(phieuTrung.registered_by_name)}` : ''}
            {' '}({phieuTrung.items_count} dòng). Mỗi ca chỉ được một phiếu nên không gửi thêm phiếu mới được.
          </p>
          <ul className="text-sm text-red-800 list-disc pl-5 space-y-0.5">
            <li>Đổi người hoặc số giờ: bấm <strong>Sửa phiếu cũ</strong>.</li>
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

      {dayType && !phieuTrung && (
        <>
          <div className="space-y-4">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-4"
              >
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

      {dayType && !phieuTrung && (
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
