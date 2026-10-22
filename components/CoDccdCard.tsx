'use client';

// Tab "In phiếu DCCD" bộ phận Coating: CĐ 86 → mã Coating · CĐ 84 → mã A/B.
// Cả hai TỰ LẤY theo route hiện hành ERP (app chính, agent đẩy kèm catalog LOT) — anh Hữu 06/10 (84) + 22/10/2026 (86).
// Đọc qua /api/co-codes (vài KB). Chưa tải được thì 86 dùng tạm 15 mã lib/co-items.ts.
import { DccdCard } from './PlanView';
import { DCCD_GJ_BY_DEPT } from '@/lib/departments';
import { useCoCodes } from './CoCodes';

export default function CoDccdCard() {
  const co = useCoCodes('86');
  const ab = useCoCodes('84');
  return <DccdCard options={DCCD_GJ_BY_DEPT.CO} onlyCodes={{ '86': co.map((c) => c[0]), '84': ab.map((c) => c[0]) }} />;
}
