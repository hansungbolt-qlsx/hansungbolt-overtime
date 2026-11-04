'use client';

import { presetOf, presetText, type Shift } from '@/lib/overtime-shift';

// Chọn ca cho NGÀY THƯỜNG (anh Hữu 21/10/2026): PM mặc định, AM = tăng ca sáng.
// Dùng chung cho form đăng ký tổ trưởng, form QLSX và form sửa phiếu của tổ trưởng.
// Giờ là giờ mặc định — chỉ admin sửa giờ thực tế từng dòng.
// pmGioRieng (anh Hữu 04/11/2026): form tổ trưởng chọn 3h/4h/Khác từng người → nút PM chỉ ghi
// "Bắt đầu 16:30", không ghi 16:30 – 19:30 (3h) nữa cho khỏi hiểu nhầm cả phiếu 3 giờ.
export default function ShiftPicker({
  value,
  onChange,
  pmGioRieng = false,
}: {
  value: Shift;
  onChange: (s: Shift) => void;
  pmGioRieng?: boolean;
}) {
  return (
    <div className="mt-3">
      <span className="block text-sm font-semibold text-brand-navy mb-1.5">Ca tăng ca</span>
      <div className="grid grid-cols-2 gap-2">
        {(['PM', 'AM'] as const).map((s) => {
          const active = value === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`py-2 rounded-md border text-sm font-medium transition leading-tight ${
                active
                  ? 'bg-brand-teal text-white border-brand-teal'
                  : 'bg-white text-brand-navy border-gray-300 hover:border-brand-teal'
              }`}
            >
              <span className="block font-bold">{s === 'PM' ? 'PM · Chiều' : 'AM · Sáng'}</span>
              <span className={`block text-xs ${active ? 'text-white/90' : 'text-brand-navy-soft'}`}>
                {s === 'PM' && pmGioRieng
                  ? `Bắt đầu ${presetOf('weekday', 'PM').time_from.slice(0, 5)}`
                  : presetText(presetOf('weekday', s))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
