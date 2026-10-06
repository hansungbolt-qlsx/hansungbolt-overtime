import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { CO_STAGES, canEditCoDay, canUseCoDay, isISODate, parseStage } from '@/lib/co-day';
import { LINE_COLS, cleanLine, ensureDraftSlip, readCoDeleted, writeCoDeleted, type LineIn } from '@/lib/co-day-server';

export const runtime = 'nodejs';

// GET /api/co-days?date=YYYY-MM-DD[&stage=84] → { slip, lines, employees } — Sản lượng CO hàng ngày (anh Hữu 05/10/2026)
// stage (06/10/2026): '86' Coating (mặc định) · '84' A/B
export async function GET(req: Request) {
  const session = await getSession();
  if (!canUseCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const date = sp.get('date');
  const stage = parseStage(sp.get('stage'));
  if (!isISODate(date)) return NextResponse.json({ error: 'Sai date (YYYY-MM-DD)' }, { status: 400 });

  const [{ data: slip, error: e1 }, { data: emps, error: e2 }] = await Promise.all([
    supabaseAdmin
      .from('co_day_slips')
      .select('id, uid, work_date, stage, status, sent_at, sent_by_name, received_at, last_error')
      .eq('work_date', date)
      .eq('stage', stage)
      .maybeSingle(),
    supabaseAdmin
      .from('employees')
      .select('id, full_name, order_no')
      .eq('department', 'CO')
      .eq('active', true)
      .order('order_no'),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });
  let lines: unknown[] = [];
  if (slip) {
    const { data, error } = await supabaseAdmin
      .from('co_day_lines').select(LINE_COLS).eq('slip_id', slip.id).order('seq_no');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    lines = data ?? [];
  }
  return NextResponse.json({ date, stage, slip: slip ?? null, lines, employees: emps ?? [], machines: CO_STAGES[stage].machines });
}

// POST /api/co-days  { date, stage?, line } → thêm 1 dòng
export async function POST(req: Request) {
  const session = await getSession();
  if (!canEditCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { date?: string; stage?: string; line?: LineIn } | null;
  if (!body || !isISODate(body.date) || !body.line) {
    return NextResponse.json({ error: 'Thiếu date hoặc line' }, { status: 400 });
  }
  const stage = parseStage(body.stage);
  const c = await cleanLine(body.line, stage);
  if (c.error) return NextResponse.json({ error: c.error }, { status: 400 });
  const s = await ensureDraftSlip(body.date, session!.fullName, stage);
  if (s.error) return NextResponse.json({ error: s.error }, { status: 500 });
  const { data: last } = await supabaseAdmin
    .from('co_day_lines').select('seq_no').eq('slip_id', s.id!).order('seq_no', { ascending: false }).limit(1);
  const seq = (last?.[0]?.seq_no ?? 0) + 1;
  const { data, error } = await supabaseAdmin.from('co_day_lines')
    .insert({ ...c.row, slip_id: s.id, seq_no: seq, created_by_name: session!.fullName })
    .select(LINE_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, line: data });
}

// DELETE /api/co-days?date=YYYY-MM-DD — xoá CẢ phiếu ngày (anh Hữu 05/10/2026: xoá ở app tăng ca hay app chính đều được).
// Phiếu app chính đang giữ (đã nhận / đang đẩy / sửa sau khi gửi) → ghi hàng chờ xoá, agent báo app chính xoá theo (~1 phút).
// Phiếu chưa từng về app chính, hoặc app chính đã xoá trả về → chỉ xoá ở đây.
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!canEditCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const date = sp.get('date');
  const stage = parseStage(sp.get('stage'));
  if (!isISODate(date)) return NextResponse.json({ error: 'Sai date (YYYY-MM-DD)' }, { status: 400 });
  const { data: slip } = await supabaseAdmin.from('co_day_slips')
    .select('id, uid, status, main_ref, received_at').eq('work_date', date).eq('stage', stage).maybeSingle();
  if (!slip) return NextResponse.json({ error: 'Ngày này không có phiếu' }, { status: 404 });
  const onMain = slip.status !== 'draft' || !!slip.main_ref || !!slip.received_at;
  if (onMain) {
    const q = (await readCoDeleted()).filter((x) => x.uid !== slip.uid);
    q.push({ uid: slip.uid, work_date: date, by: session!.fullName, at: new Date().toISOString() });
    const e = await writeCoDeleted(q);
    if (e) return NextResponse.json({ error: `Không ghi được hàng chờ xoá: ${e}` }, { status: 500 });
  }
  const { error } = await supabaseAdmin.from('co_day_slips').delete().eq('id', slip.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, main_delete_queued: onMain });
}
