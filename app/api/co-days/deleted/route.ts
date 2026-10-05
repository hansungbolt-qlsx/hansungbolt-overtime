import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { readCoDeleted, writeCoDeleted } from '@/lib/co-day-server';

export const runtime = 'nodejs';

// Hàng chờ xoá phiếu Sản lượng CO sang app chính — chỉ agent (admin/qlsx) (anh Hữu 05/10/2026).
//   GET  → [{uid, work_date, by, at}]
//   POST {uid} → gỡ uid khỏi hàng chờ sau khi app chính đã xoá
function allowed(role?: string) { return role === 'admin' || role === 'qlsx'; }

export async function GET() {
  const s = await getSession();
  if (!s || !allowed(s.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  return NextResponse.json({ items: await readCoDeleted() });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || !allowed(s.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { uid?: string } | null;
  if (!b?.uid) return NextResponse.json({ error: 'Thiếu uid' }, { status: 400 });
  const e = await writeCoDeleted((await readCoDeleted()).filter((x) => x.uid !== b.uid));
  if (e) return NextResponse.json({ error: e }, { status: 500 });
  return NextResponse.json({ ok: true });
}
