import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { CO_LOTS_BUCKET, CO_STAGES, canUseCoDay, parseStage } from '@/lib/co-day';

export const runtime = 'nodejs';

// Catalog LOT xi mạ (công đoạn 80, 120 ngày) cho màn Sản lượng CO — anh Hữu 05/10/2026.
// POST — agent (đăng nhập admin qlsx) đẩy catalog kéo từ app chính /api/ot/co-lots (mỗi 10').
// GET  — điện thoại CO tải 1 lần rồi tra tại chỗ khi quét (≈4.500 lot, ~700 KB).
// ?stage=84 (06/10/2026): catalog A/B riêng (ab-lots.json) — mã có công đoạn 84, app chính tự lấy từ ERP.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const payload = await req.text();
  try {
    const j = JSON.parse(payload);
    if (!Array.isArray(j?.lots)) throw new Error('thiếu lots');
  } catch (e) {
    return NextResponse.json({ error: `Body không hợp lệ: ${(e as Error).message}` }, { status: 400 });
  }
  const path = CO_STAGES[parseStage(new URL(req.url).searchParams.get('stage'))].lotsPath;
  const { error } = await supabaseAdmin.storage
    .from(CO_LOTS_BUCKET)
    .upload(path, Buffer.from(payload, 'utf8'), { contentType: 'application/json', upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!canUseCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const path = CO_STAGES[parseStage(new URL(req.url).searchParams.get('stage'))].lotsPath;
  const { data, error } = await supabaseAdmin.storage.from(CO_LOTS_BUCKET).download(path);
  if (error || !data) {
    return NextResponse.json({ lots: [], generated_at: null, error: 'Chưa có danh sách LOT (agent chưa đẩy)' });
  }
  const text = await data.text();
  return new NextResponse(text, {
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
  });
}
