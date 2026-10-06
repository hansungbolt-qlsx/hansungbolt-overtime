import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { CO_LOTS_BUCKET, CO_STAGES, canUseCoDay, isISODate, unitWeights, type CoStage } from '@/lib/co-day';

export const runtime = 'nodejs';

// TỔNG HỢP SẢN LƯỢNG theo ngày (anh Hữu chốt 06/10/2026) — bộ phận Coating, 2 khối: CO (CĐ 86) · AB (CĐ 84).
// Mỗi khối: từng mã hàng làm trong ngày → Σ trọng lượng (kg) + Σ số lượng (EA) = kg × 1000 ÷ trọng lượng thành phẩm 1 EA
// (ERP Good.gdanjung, 0 → DanJung — có sẵn trong catalog LOT items[i][3]). Tính CẢ dòng chưa bấm Gửi (sáng hôm sau tự đẩy).
// GET /api/co-summary?date=YYYY-MM-DD

const STAGE_ORDER: CoStage[] = ['86', '84'];
let gCache: { at: number; map: Map<string, number> } | null = null;   // bảng g/EA, giữ 10' mỗi phiên máy chủ

async function loadUnitWeights(): Promise<Map<string, number>> {
  if (gCache && Date.now() - gCache.at < 600_000) return gCache.map;
  const map = new Map<string, number>();
  for (const st of STAGE_ORDER) {
    const { data } = await supabaseAdmin.storage.from(CO_LOTS_BUCKET).download(CO_STAGES[st].lotsPath);
    if (!data) continue;
    try {
      for (const [k, v] of unitWeights(JSON.parse(await data.text()))) map.set(k, v);
    } catch { /* catalog hỏng → mã đó không quy đổi được EA */ }
  }
  gCache = { at: Date.now(), map };
  return map;
}

type Line = { slip_id: string; item_code: string | null; item_name: string | null; weight_kg: number };

export async function GET(req: Request) {
  const session = await getSession();
  if (!canUseCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const date = new URL(req.url).searchParams.get('date');
  if (!isISODate(date)) return NextResponse.json({ error: 'Sai date (YYYY-MM-DD)' }, { status: 400 });

  const { data: slips, error: e1 } = await supabaseAdmin
    .from('co_day_slips').select('id, stage, status').eq('work_date', date);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const ids = (slips ?? []).map((s) => s.id);
  let lines: Line[] = [];
  if (ids.length) {
    const { data, error } = await supabaseAdmin
      .from('co_day_lines').select('slip_id, item_code, item_name, weight_kg').in('slip_id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    lines = (data ?? []) as Line[];
  }
  const gmap = lines.length ? await loadUnitWeights() : new Map<string, number>();

  const stages = STAGE_ORDER.map((st) => {
    const slip = (slips ?? []).find((s) => (s.stage ?? '86') === st) ?? null;
    const by = new Map<string, { item_code: string; item_name: string; n_lot: number; kg: number }>();
    for (const l of lines.filter((x) => slip && x.slip_id === slip.id)) {
      const code = (l.item_code ?? '').trim() || '(chưa có mã)';
      const g = by.get(code) ?? { item_code: code, item_name: l.item_name ?? '', n_lot: 0, kg: 0 };
      g.n_lot += 1;
      g.kg += Number(l.weight_kg) || 0;
      if (!g.item_name && l.item_name) g.item_name = l.item_name;
      by.set(code, g);
    }
    const items = [...by.values()]
      .map((g) => {
        const gEa = gmap.get(g.item_code.toUpperCase()) ?? 0;
        const kg = Math.round(g.kg * 1000) / 1000;
        return { ...g, kg, g_ea: gEa || null, ea: gEa > 0 ? Math.round((kg * 1000) / gEa) : null };
      })
      .sort((a, b) => a.item_code.localeCompare(b.item_code));
    return {
      stage: st,
      short: CO_STAGES[st].short,
      status: slip?.status ?? null,
      n_lot: items.reduce((s, x) => s + x.n_lot, 0),
      total_kg: Math.round(items.reduce((s, x) => s + x.kg, 0) * 1000) / 1000,
      total_ea: items.reduce((s, x) => s + (x.ea ?? 0), 0),
      n_no_g: items.filter((x) => x.ea === null).length,
      items,
    };
  });
  return NextResponse.json({ date, stages });
}
