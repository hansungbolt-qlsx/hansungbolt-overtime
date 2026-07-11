'use client';

import { useEffect, useState } from 'react';

type PrintJob = {
  id: string;
  type: 'registration' | 'labels_day';
  ref_id: string;
  status: 'pending' | 'printing' | 'done' | 'error';
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
};

const OFFICE_HOURS_START = 8;
const OFFICE_HOURS_END = 17;

function isWithinOfficeHoursClient(): boolean {
  // Client-side check dùng giờ máy user. Server sẽ check lại giờ VN chính xác.
  const h = new Date().getHours();
  return h >= OFFICE_HOURS_START && h < OFFICE_HOURS_END;
}

// Component nút "Gửi in" + badge status polling.
// type = 'registration' -> refId là uuid phiếu
// type = 'labels_day'   -> refId là YYYY-MM-DD
export default function PrintJobButton({
  type,
  refId,
  label = 'Gửi in',
  compact = false,
}: {
  type: 'registration' | 'labels_day';
  refId: string;
  label?: string;
  compact?: boolean;
}) {
  const [job, setJob] = useState<PrintJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load job gần nhất cho ref_id này (nếu có)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/print-jobs/mine')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const found = (d.jobs ?? []).find(
          (j: PrintJob) => j.type === type && j.ref_id === refId,
        );
        if (found) setJob(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type, refId]);

  // Poll job status mỗi 3s khi job đang pending/printing
  useEffect(() => {
    if (!job || (job.status !== 'pending' && job.status !== 'printing')) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/print-jobs/mine');
        const d = await res.json();
        const found = (d.jobs ?? []).find((j: PrintJob) => j.id === job.id);
        if (found) setJob(found);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [job]);

  async function send() {
    setErr(null);
    if (!isWithinOfficeHoursClient()) {
      setErr('Máy in đang tắt ngoài giờ hành chính (8h-17h)');
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
      setJob(d.job);
    } finally {
      setBusy(false);
    }
  }

  // Đang có job active → hiển thị badge status thay nút
  if (job && (job.status === 'pending' || job.status === 'printing')) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md font-semibold ${compact ? 'text-xs px-2 py-1' : 'text-xs px-2.5 py-1.5'} bg-amber-100 text-amber-800`}
      >
        <SpinnerIcon />
        {job.status === 'pending' ? 'Đang gửi in...' : 'Đang in...'}
      </span>
    );
  }

  if (job && job.status === 'done') {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className={`inline-flex items-center gap-1 rounded-md font-semibold ${compact ? 'text-xs px-2 py-1' : 'text-xs px-2.5 py-1.5'} bg-green-100 text-green-800`}
        >
          ✓ Đã in
        </span>
        <button
          type="button"
          onClick={send}
          disabled={busy}
          title="Gửi in lại 1 lần nữa"
          className={`inline-flex items-center gap-1 rounded-md font-semibold transition active:scale-95 ${compact ? 'text-[11px] px-1.5 py-1' : 'text-xs px-2 py-1.5'} bg-white hover:bg-gray-100 disabled:opacity-60 text-brand-navy border border-brand-surface-alt`}
        >
          {busy ? <SpinnerIcon /> : '↻'} In lại
        </button>
      </span>
    );
  }

  if (job && job.status === 'error') {
    return (
      <button
        type="button"
        onClick={send}
        disabled={busy}
        title={job.error_message ?? 'Lỗi in'}
        className={`inline-flex items-center gap-1 rounded-md font-semibold ${compact ? 'text-xs px-2 py-1' : 'text-xs px-2.5 py-1.5'} bg-red-100 hover:bg-red-200 text-red-800 transition`}
      >
        ⚠ Lỗi — Gửi lại
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className={`inline-flex items-center gap-1 rounded-md font-semibold transition active:scale-95 ${compact ? 'text-xs px-2 py-1' : 'text-xs px-2.5 py-1.5'} bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-60 text-white`}
      >
        {busy ? <SpinnerIcon /> : <PrinterIcon />}
        {busy ? 'Đang gửi...' : label}
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
