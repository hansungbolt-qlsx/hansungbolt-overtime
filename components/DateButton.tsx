'use client';

// Nút hiển thị "Ngày DD/MM/YYYY" bằng tiếng Việt (chữ N viết hoa).
// Ô <input type="date"> trong suốt phủ kín nút ⇒ chạm vào đâu cũng chạm đúng ô date thật.
export default function DateButton({
  value,
  onChange,
  className = '',
  compact = false,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const [y, m, d] = value.split('-');
  const label = y && m && d ? `Ngày ${d}/${m}/${y}` : 'Chọn ngày';

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
      className={`relative inline-flex items-center gap-1.5 cursor-pointer bg-white border border-brand-surface-alt rounded-lg font-semibold text-brand-navy hover:bg-[#f0f5ff] transition ${
        compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm'
      } ${className}`}
    >
      <CalendarIcon />
      <span>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => openPickerIfMouse(e.currentTarget)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        // 16px: iPhone không tự phóng to trang khi chạm vào ô
        style={{ colorScheme: 'light', fontSize: 16 }}
        aria-label="Đổi ngày"
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
      className="w-4 h-4 text-brand-navy-soft"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
