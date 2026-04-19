'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function PrintControls({
  id,
  autoprint,
}: {
  id: string;
  autoprint: boolean;
}) {
  const printedRef = useRef(false);

  useEffect(() => {
    if (autoprint && !printedRef.current) {
      printedRef.current = true;
      const t = setTimeout(() => window.print(), 400);
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
        In phiếu
      </button>
      <a
        href={`/api/export/${id}`}
        className="text-sm px-4 py-2 bg-brand-navy hover:bg-brand-navy-soft text-white font-semibold rounded-md transition"
      >
        Tải .xlsx
      </a>
    </div>
  );
}
