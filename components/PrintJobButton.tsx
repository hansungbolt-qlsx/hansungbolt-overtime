'use client';

import { useState } from 'react';

const OFFICE_HOURS_START = 8;
const OFFICE_HOURS_END = 17;

function isWithinOfficeHoursClient(): boolean {
  const h = new Date().getHours();
  return h >= OFFICE_HOURS_START && h < OFFICE_HOURS_END;
}

// Nút đơn giản: click để gửi lệnh in. Sau khi gửi thành công hiện "✓ Đã gửi"
// 2.5s rồi quay lại nút "In phiếu" ngay để có thể bấm in tiếp nếu cần.
export default function PrintJobButton({
  type,
  refId,
  label = 'In phiếu',
  compact = false,
}: {
  type: 'registration' | 'labels_day';
  refId: string;
  label?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setErr(null);
    if (!isWithinOfficeHoursClient()) {
      setErr('Ngoài giờ 8h-17h, máy in tắt');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ref_id: refId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || `Lỗi ${res.status}`);
        return;
      }
      setJustSent(true);
      setTimeout(() => setJustSent(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  const sizeCls = compact ? 'text-xs px-2.5 py-1' : 'text-xs px-2.5 py-1.5';

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className={`inline-flex items-center gap-1 rounded-md font-semibold transition active:scale-95 ${sizeCls} ${
          justSent
            ? 'bg-green-100 text-green-800'
            : 'bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-60 text-white'
        }`}
      >
        {busy ? <SpinnerIcon /> : justSent ? <CheckIcon /> : <PrinterIcon />}
        {busy ? 'Đang gửi...' : justSent ? 'Đã gửi' : label}
      </button>
      {err && (
        <span className="text-[10px] text-red-600 max-w-[180px] text-right leading-tight">
          {err}
        </span>
      )}
    </div>
  );
}

function PrinterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5"
      aria-hidden="true"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
