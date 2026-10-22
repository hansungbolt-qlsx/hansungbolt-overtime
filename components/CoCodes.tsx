'use client';

// Mã hàng công đoạn 86 / 84 theo route hiện hành ERP (anh Hữu 22/10/2026) — đọc /api/co-codes (vài KB).
// Chưa tải được (agent chưa đẩy, mất mạng) → 86 dùng tạm 15 mã trong lib/co-items.ts để không trống.
import { useEffect, useState } from 'react';
import { CO_ITEMS, CO_ITEMS_DATALIST_ID, findCoItem } from '@/lib/co-items';

export type CoCode = [string, string];   // [mã, tên]
const CO_DU_PHONG: CoCode[] = CO_ITEMS.map((i) => [i.code, i.name]);

export function useCoCodes(stage: '86' | '84'): CoCode[] {
  const [codes, setCodes] = useState<CoCode[]>(stage === '86' ? CO_DU_PHONG : []);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/co-codes?stage=${stage}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !Array.isArray(j?.codes) || j.codes.length === 0) return;
        setCodes(j.codes as CoCode[]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [stage]);
  return codes;
}

/** Gợi ý mã cho form tăng ca CO: đủ mã 86 theo ERP; mã có RPM chuẩn (lib/co-items.ts) ghi RPM, còn lại gõ tay. */
export function CoItemsDatalist() {
  const codes = useCoCodes('86');
  return (
    <datalist id={CO_ITEMS_DATALIST_ID}>
      {codes.map(([code, name]) => {
        const it = findCoItem(code);
        return (
          <option key={code} value={code}>
            {it ? `RPM ${it.rpm} · ${it.coating} · ${it.name}` : `Chưa có RPM — gõ tay · ${name}`}
          </option>
        );
      })}
    </datalist>
  );
}
