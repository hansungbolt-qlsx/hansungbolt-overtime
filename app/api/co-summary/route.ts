import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { CO_LOTS_BUCKET, CO_STAGES, canUseCoDay, decodeCoLots, isISODate, unitWeights, type CoStage } from '@/lib/co-day';

export const runtime = 'nodejs';

// TỔNG HỢP SẢN LƯỢNG theo ngày (anh Hữu chốt 06/10/2026) — bộ phận Coating, 2 khối: CO (CĐ 86) · AB (CĐ 84).
// Mỗi khối: từng mã hàng làm trong ngày → Σ trọng lượng (kg) + Σ số lượng (EA) = kg × 1000 ÷ trọng lượng thành phẩm 1 EA
// (ERP Good.gdanjung, 0 → DanJung — có sẵn trong catalog LOT items[i][3]). Tính CẢ dòng chưa bấm Gửi (sáng hôm sau tự đẩy).
// GET /api/co-summary?date=YYYY-MM-DD

const STAGE_ORDER: CoStage[] = ['86', '84'];
// bảng g/EA + nhãn LOT ('2610030154' → '261003-0154-NPT', cho dòng gõ tay cũ chưa có nhãn), giữ 10' mỗi phiên máy chủ
let gCache: { at: number; map: Map<string, number>; labels: Map<string, string> } | null = null;

async function loadUnitWeights(): Promise<{ map: Map<string, number>; labels: Map<string, string> }> {
  if (gCache && Date.now() - gCache.at < 600_000) return gCache;
  const map = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const st of STAGE_ORDER) {
    const { data } = await supabaseAdmin.storage.from(CO_LOTS_BUCKET).download(CO_STAGES[st].lotsPath);
    if (!data) continue;
    try {
      const j = JSON.parse(await data.text());
      for (const [k, v] of unitWeights(j)) map.set(k, v);
      for (const [k, l] of decodeCoLots(j)) labels.set(k, l.label);
    } catch { /* catalog hỏng → mã đó không quy đổi được EA */ }
  }
  gCache = { at: Date.now(), map, labels };
  return gCache;
}

type Line = { slip_id: string; seq_no: number; machine: string | null; lot_no: string; lot_label: string | null; saeji: string | null; created_at: string;
  item_code: string | null; item_name: string | null; weight_kg: number };
// Chi tiết từng LOT khi bấm số LOT (anh Hữu 07/10/2026): chỉ LOT NO · Trọng lượng · Số lượng
type LotRow = { time: string; lot: string; kg: number; ea: number | null };
// Giờ nhập LOT = lúc bấm lưu dòng vào phiếu (co_day_lines.created_at, Sửa dòng không đổi) → 'HH:MM' giờ Việt Nam (Vercel chạy UTC)
const vnHHMM = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3600_000); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(11, 16); };

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
      .from('co_day_lines').select('slip_id, seq_no, machine, lot_no, lot_label, saeji, item_code, item_name, weight_kg, created_at').in('slip_id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    lines = (data ?? []) as Line[];
  }
  const { map: gmap, labels } = lines.length ? await loadUnitWeights() : { map: new Map<string, number>(), labels: new Map<string, string>() };
  lines.sort((a, b) => (a.machine ?? '~').localeCompare(b.machine ?? '~') || a.seq_no - b.seq_no);

  const stages = STAGE_ORDER.map((st) => {
    const slip = (slips ?? []).find((s) => (s.stage ?? '86') === st) ?? null;
    const by = new Map<string, { item_code: string; item_name: string; n_lot: number; kg: number; lots: { at: string; time: string; lot: string; kg: number }[]; saejis: string[] }>();
    for (const l of lines.filter((x) => slip && x.slip_id === slip.id)) {
      const code = (l.item_code ?? '').trim() || '(chưa có mã)';
      const g = by.get(code) ?? { item_code: code, item_name: l.item_name ?? '', n_lot: 0, kg: 0, lots: [], saejis: [] };
      // Chỉ thị thư hiện dưới mã hàng (anh Hữu 07/10/2026): '202607261' → '607-261', mỗi chỉ thị 1 dòng, không trùng
      const sj = (l.saeji ?? '').trim();
      const sjDisp = sj.length >= 6 ? `${sj.slice(-6, -3)}-${sj.slice(-3)}` : sj;
      if (sjDisp && !g.saejis.includes(sjDisp)) g.saejis.push(sjDisp);
      g.n_lot += 1;
      g.kg += Number(l.weight_kg) || 0;
      g.lots.push({ at: l.created_at, time: vnHHMM(l.created_at), lot: l.lot_label || labels.get(l.lot_no) || l.lot_no, kg: Number(l.weight_kg) || 0 });
      if (!g.item_name && l.item_name) g.item_name = l.item_name;
      by.set(code, g);
    }
    const items = [...by.values()]
      .map((g) => {
        const gEa = gmap.get(g.item_code.toUpperCase()) ?? 0;
        const kg = Math.round(g.kg * 1000) / 1000;
        // Làm tròn EA TỪNG LOT rồi cộng → EA của mã = Σ EA các LOT, khớp tuyệt đối với bảng chi tiết (anh Hữu 07/10/2026)
        // Chi tiết LOT xếp theo giờ nhập (mã chạy nhiều máy vẫn đúng trình tự thời gian)
        const lots: LotRow[] = [...g.lots].sort((a, b) => a.at.localeCompare(b.at))
          .map((x) => ({ time: x.time, lot: x.lot, kg: x.kg, ea: gEa > 0 ? Math.round((x.kg * 1000) / gEa) : null }));
        return { ...g, lots, kg, g_ea: gEa || null, ea: gEa > 0 ? lots.reduce((s, x) => s + (x.ea ?? 0), 0) : null };
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
