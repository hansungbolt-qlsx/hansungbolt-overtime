'use client';

// Tab "In phiếu DCCD" bộ phận Coating: CĐ 86 → 15 mã Coating (lib/co-items.ts) · CĐ 84 → mã A/B
// app chính tự lấy từ ERP (đọc từ catalog LOT A/B, anh Hữu 06/10/2026).
import { useEffect, useState } from 'react';
import { DccdCard } from './PlanView';
import { DCCD_GJ_BY_DEPT } from '@/lib/departments';
import { CO_ITEMS } from '@/lib/co-items';

const CO_CODES = CO_ITEMS.map((i) => i.code);

export default function CoDccdCard() {
  const [abCodes, setAbCodes] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/co-lots?stage=84')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const items = Array.isArray(j?.items) ? (j.items as unknown[]) : [];
        setAbCodes(items.filter(Array.isArray).map((i) => String((i as unknown[])[0])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return <DccdCard options={DCCD_GJ_BY_DEPT.CO} onlyCodes={{ '86': CO_CODES, '84': abCodes }} />;
}
