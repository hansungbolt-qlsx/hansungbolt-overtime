import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { CO_LOTS_BUCKET, CO_STAGES, canUseCoDay, parseStage } from '@/lib/co-day';

export const runtime = 'nodejs';

// Danh sách MÃ HÀNG công đoạn 86 (Coating) / 84 (A/B) theo route hiện hành ERP — anh Hữu 22/10/2026.
// Lấy từ catalog LOT agent đã đẩy (app chính tự lấy mã từ ERP), chỉ trả [mã, tên] (vài KB) thay vì cả catalog
// (~134 KB) → thẻ In DCCD + form tăng ca CO không tốn hạn mức Free. Giữ 10′ trong bộ nhớ server + 10′ trình duyệt.
const GIU_MS = 600_000;
const cache = new Map<string, { at: number; body: string }>();

export async function GET(req: Request) {
  const session = await getSession();
  if (!canUseCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const stage = parseStage(new URL(req.url).searchParams.get('stage'));
  const hit = cache.get(stage);
  let body = hit && Date.now() - hit.at < GIU_MS ? hit.body : null;
  if (!body) {
    const { data, error } = await supabaseAdmin.storage.from(CO_LOTS_BUCKET).download(CO_STAGES[stage].lotsPath);
    if (error || !data) return NextResponse.json({ codes: [], generated_at: null, error: 'Chưa có danh sách (agent chưa đẩy)' });
    const j = JSON.parse(await data.text()) as { items?: unknown[]; generated_at?: string };
    const codes = (Array.isArray(j.items) ? j.items : [])
      .filter(Array.isArray)
      .map((i) => [String((i as unknown[])[0] ?? ''), String((i as unknown[])[1] ?? '')])
      .filter(([c]) => c);
    body = JSON.stringify({ stage, codes, generated_at: j.generated_at ?? null });
    cache.set(stage, { at: Date.now(), body });
  }
  return new NextResponse(body, {
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=600' },
  });
}
