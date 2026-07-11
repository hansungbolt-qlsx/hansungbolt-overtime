'use client';

import { useEffect, useRef, useState } from 'react';

const OFFICE_HOURS_START = 8;
const OFFICE_HOURS_END = 17;

function isWithinOfficeHoursClient(): boolean {
  const h = new Date().getHours();
  return h >= OFFICE_HOURS_START && h < OFFICE_HOURS_END;
}

type MsgTone = 'wait' | 'ok' | 'warn' | 'err';

const TONE_CLS: Record<MsgTone, string> = {
  wait: 'text-brand-navy-soft',
  ok: 'text-green-700',
  warn: 'text-amber-700',
  err: 'text-red-600',
};

// Sau bao lâu job vẫn pending thì cảnh báo máy chủ in có thể đang tắt
// (agent poll 10s + render ~25s → quá 40s chưa nhận là bất thường)
const WARN_PENDING_MS = 40_000;
// Tổng thời gian theo dõi tối đa
const TRACK_TIMEOUT_MS = 120_000;
const POLL_MS = 3_000;

// Nút gửi lệnh in + theo dõi job tới khi in xong:
// Gửi → "Chờ máy in nhận lệnh..." → "Đang in..." → "✓ Đã in xong" / lỗi.
// Quá 40s chưa được nhận → cảnh báo máy chủ in đang tắt (tránh việc người
// dùng bấm lại nhiều lần vì không biết lệnh có tới máy in hay không).
export default function PrintJobButton({
  type,
  refId,
  label = 'In phiếu',
  compact = false,
}: {
  type: 'registration' | 'labels_day' | 'overtime_summary';
  refId: string;
  label?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: MsgTone } | null>(null);
  const cancelRef = useRef(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      cancelRef.current = true;
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    },
    [],
  );

  function flashThenClear(text: string, tone: MsgTone) {
    setMsg({ text, tone });
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setMsg(null), 6000);
  }

  async function track(jobId: string) {
    setTracking(true);
    const t0 = Date.now();
    try {
      while (!cancelRef.current && Date.now() - t0 < TRACK_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        let job: { status?: string; error_message?: string | null } | null = null;
        try {
          const res = await fetch('/api/print-jobs/mine');
          const d = await res.json();
          job =
            (d.jobs ?? []).find((j: { id: string }) => j.id === jobId) ?? null;
        } catch {
          // Mạng chập chờn — thử lại vòng sau
        }
        if (!job) continue;
        if (job.status === 'done') {
          flashThenClear('✓ Đã in xong', 'ok');
          return;
        }
        if (job.status === 'error') {
          setMsg({
            text: `Lỗi in: ${job.error_message || 'không rõ'} — báo QLSX kiểm tra`,
            tone: 'err',
          });
          return;
        }
        if (job.status === 'printing') {
          setMsg({ text: 'Đang in...', tone: 'wait' });
        } else if (Date.now() - t0 > WARN_PENDING_MS) {
          setMsg({
            text: '⚠ Máy in chưa nhận lệnh — máy chủ in có thể đang tắt, báo QLSX kiểm tra',
            tone: 'warn',
          });
        } else {
          setMsg({ text: 'Chờ máy in nhận lệnh...', tone: 'wait' });
        }
      }
      if (!cancelRef.current) {
        setMsg({
          text: '⚠ Chưa xác nhận được kết quả in — kiểm tra máy in hoặc thử lại sau',
          tone: 'warn',
        });
      }
    } finally {
      setTracking(false);
    }
  }

  async function send() {
    setMsg(null);
    if (!isWithinOfficeHoursClient()) {
      setMsg({ text: 'Ngoài giờ 8h-17h, máy in tắt', tone: 'err' });
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
        setMsg({ text: d.error || `Lỗi ${res.status}`, tone: 'err' });
        return;
      }
      setMsg({
        text: d.duplicate
          ? 'Lệnh này đã gửi trước đó — đang chờ in, không gửi thêm bản trùng'
          : 'Đã gửi — chờ máy in nhận lệnh...',
        tone: 'wait',
      });
      void track(d.job.id);
    } finally {
      setBusy(false);
    }
  }

  const sizeCls = compact ? 'text-xs px-2.5 py-1' : 'text-xs px-2.5 py-1.5';
  const disabled = busy || tracking;
  const isDone = msg?.tone === 'ok';

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={send}
        disabled={disabled}
        className={`inline-flex items-center gap-1 rounded-md font-semibold transition active:scale-95 ${sizeCls} ${
          isDone
            ? 'bg-green-100 text-green-800'
            : 'bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-60 text-white'
        }`}
      >
        {busy || tracking ? <SpinnerIcon /> : isDone ? <CheckIcon /> : <PrinterIcon />}
        {busy ? 'Đang gửi...' : tracking ? 'Đang in...' : isDone ? 'Đã in' : label}
      </button>
      {msg && (
        <span
          className={`text-[10px] max-w-[200px] text-right leading-tight ${TONE_CLS[msg.tone]}`}
        >
          {msg.text}
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
