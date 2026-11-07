'use client';

import { dateLabel } from '@/lib/date-label';

export { dateLabel };

// Ô chọn ngày / tháng DÙNG CHUNG toàn app (anh Hữu chốt 07/11/2026):
//   · chỉ ghi ngắn gọn "07/11/2026" (tháng: "11/2026") — không chữ "Ngày", không kiểu Mỹ/ISO
//   · viền rõ + biểu tượng lịch + mũi tên ▾ ⇒ nhìn là biết bấm vào đổi được
// Ô <input type="date|month"> trong suốt phủ kín nút ⇒ chạm vào đâu cũng chạm đúng ô thật.
export default function DateButton({
  value,
  onChange,
  className = '',
  compact = false,
  mode = 'date',
  min,
  max,
  disabled = false,
  ariaLabel,
}: {
  value: string; // date: YYYY-MM-DD · month: YYYY-MM
  onChange: (v: string) => void;
  className?: string;
  compact?: boolean;
  mode?: 'date' | 'month';
  min?: string;
  max?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const label = dateLabel(value, mode);

  // Máy có chuột (Chrome desktop): bấm vào ô date chỉ focus từng phần ngày/tháng,
  // không tự mở lịch ⇒ gọi showPicker(). Điện thoại (iPhone/Android): chạm thẳng vào
  // ô date là trình duyệt tự mở lịch — KHÔNG gọi showPicker (iPhone Safari bỏ qua
  // lặng lẽ, lịch không mở; anh Hữu báo 10/10/2026 tổ trưởng CO không lùi ngày được).
  function openPickerIfMouse(el: HTMLInputElement) {
    if (typeof window === 'undefined' || !window.matchMedia?.('(pointer: fine)').matches) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
      } catch {}
    }
  }

  return (
    <label
      className={`relative inline-flex items-center gap-1.5 whitespace-nowrap bg-white border-2 border-brand-teal/60 rounded-lg font-bold text-brand-navy tabular-nums transition ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-brand-teal hover:bg-[#effaf8]'
      } ${compact ? 'px-2 py-1 text-[13px]' : 'px-3 py-1.5 text-sm'} ${className}`}
    >
      <CalendarIcon />
      <span>{label}</span>
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-brand-teal-dark -mr-0.5 shrink-0" aria-hidden="true">
        <path d="M5.5 7.5 10 12l4.5-4.5z" />
      </svg>
      <input
        type={mode}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => openPickerIfMouse(e.currentTarget)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        // 16px: iPhone không tự phóng to trang khi chạm vào ô
        style={{ colorScheme: 'light', fontSize: 16 }}
        aria-label={ariaLabel ?? (mode === 'month' ? 'Đổi tháng' : 'Đổi ngày')}
      />
    </label>
  );
}


function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 text-brand-teal-dark shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
