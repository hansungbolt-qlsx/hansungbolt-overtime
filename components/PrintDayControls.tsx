'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

// Điều khiển trang in gộp phiếu tăng ca cả ngày: autoprint=1 → tự bật hộp
// thoại in của trình duyệt sau khi trang render (delay nhỏ chờ logo tải xong).
export default function PrintDayControls({
  count,
  autoprint,
}: {
  count: number;
  autoprint: boolean;
}) {
  const printedRef = useRef(false);

  useEffect(() => {
    if (autoprint && !printedRef.current) {
      printedRef.current = true;
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [autoprint]);

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Link
        href="/dashboard"
        className="text-sm px-3 py-2 border border-brand-surface-alt text-brand-navy rounded-md hover:bg-brand-surface-alt transition"
      >
        ← Dashboard
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="text-sm px-4 py-2 bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold rounded-md shadow-md shadow-brand-teal/30 transition"
      >
        🖨 In {count} phiếu
      </button>
    </div>
  );
}
