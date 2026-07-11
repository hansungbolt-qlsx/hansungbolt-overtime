'use client';

import { useRef } from 'react';

// Nút hiển thị "Ngày DD/MM/YYYY" bằng tiếng Việt (chữ N viết hoa).
// Click nút -> mở native date picker qua showPicker() (iOS Safari 16.4+, Chrome).
// Fallback: click input để mở picker cho trình duyệt cũ.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [y, m, d] = value.split('-');
  const label = y && m && d ? `Ngày ${d}/${m}/${y}` : 'Chọn ngày';

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {}
    }
    el.click();
    el.focus();
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
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          // Trên trình duyệt hỗ trợ, showPicker gọi từ button parent để override display
          e.stopPropagation();
        }}
        className="absolute inset-0 opacity-0 cursor-pointer"
        style={{ colorScheme: 'light' }}
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute inset-0"
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
