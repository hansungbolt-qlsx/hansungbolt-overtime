'use client';

import { useEffect, useRef, useState } from 'react';
import { toTitleCase } from '@/lib/format';

// Ô chọn tên nhân viên (anh Hữu 04/11/2026): thay <select> gốc của điện thoại — hộp chọn gốc
// trên Android hẹp nên tên ngắn cũng bị xuống dòng. Bấm ô → khung danh sách rộng gần hết màn,
// mỗi tên MỘT dòng (không xuống hàng; quá dài thì cắt "…"). Chữ 16px để iPhone không tự phóng to.
// Dùng chung: form đăng ký, form tổ trưởng sửa phiếu, form QLSX.

type Employee = { id: string; full_name: string; order_no: number };

const nhan = (e: Employee) => `${e.order_no}. ${toTitleCase(e.full_name)}`;

export default function EmployeeSelect({
  value,
  employees,
  onChange,
}: {
  value: string;
  employees: Employee[];
  onChange: (employeeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const chon = employees.find((e) => e.id === value);

  // Mở khung → cuộn tới tên đang chọn; phím Esc → đóng
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-chon="1"]')?.scrollIntoView({ block: 'center' });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-300 rounded-md bg-white text-left text-base focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
      >
        <span className={`truncate whitespace-nowrap ${chon ? 'text-brand-navy' : 'text-brand-navy-soft'}`}>
          {chon ? nhan(chon) : '— Chọn nhân viên —'}
        </span>
        <svg className="w-4 h-4 flex-shrink-0 text-brand-navy-soft" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Chọn nhân viên"
            className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[75vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-surface-alt">
              <span className="text-base font-semibold text-brand-navy">Chọn nhân viên</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-brand-navy-soft px-2 py-1"
              >
                Đóng
              </button>
            </div>
            <div ref={listRef} role="listbox" className="overflow-y-auto">
              {employees.length === 0 && (
                <p className="px-4 py-3 text-sm text-brand-navy-soft">Chưa có danh sách nhân viên.</p>
              )}
              {employees.map((e) => {
                const dangChon = e.id === value;
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="option"
                    aria-selected={dangChon}
                    data-chon={dangChon ? '1' : undefined}
                    onClick={() => { onChange(e.id); setOpen(false); }}
                    className={`w-full block text-left px-4 py-3 text-base whitespace-nowrap truncate border-b border-brand-surface-alt last:border-b-0 ${
                      dangChon ? 'bg-brand-teal/10 text-brand-teal font-semibold' : 'text-brand-navy active:bg-brand-surface'
                    }`}
                  >
                    {nhan(e)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
