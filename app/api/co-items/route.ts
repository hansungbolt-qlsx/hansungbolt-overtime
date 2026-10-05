import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { CO_ITEMS } from '@/lib/co-items';

export const runtime = 'nodejs';

// Danh sách mã Coating (lib/co-items.ts) — agent đọc để app chính chỉ dựng catalog LOT của đúng các mã này (05/10/2026).
export async function GET() {
  const s = await getSession();
  if (!s || (s.role !== 'admin' && s.role !== 'qlsx')) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  return NextResponse.json({ codes: CO_ITEMS.map((i) => i.code) });
}
