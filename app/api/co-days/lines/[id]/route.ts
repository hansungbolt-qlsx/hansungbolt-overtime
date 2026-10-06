import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { canEditCoDay, parseStage, type CoStage } from '@/lib/co-day';
import { cleanLine, ensureDraftSlip, type LineIn } from '@/lib/co-day-server';

export const runtime = 'nodejs';

// Ngày + công đoạn của phiếu chứa dòng (06/10/2026: phiếu theo ngày × công đoạn)
async function slipOf(lineId: string): Promise<{ date: string; stage: CoStage } | null> {
  const { data } = await supabaseAdmin
    .from('co_day_lines').select('slip_id, co_day_slips(work_date, stage)').eq('id', lineId).maybeSingle();
  type Rel = { work_date?: string; stage?: string };
  const rel = (data as { co_day_slips?: Rel | Rel[] } | null)?.co_day_slips;
  const one = Array.isArray(rel) ? rel[0] : rel;
  return one?.work_date ? { date: one.work_date, stage: parseStage(one.stage) } : null;
}

// PATCH /api/co-days/lines/{id}  { line } — sửa dòng (phiếu tự về 'draft', phải Gửi lại)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!canEditCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const { id } = await params;
  const slip = await slipOf(id);
  if (!slip) return NextResponse.json({ error: 'Không tìm thấy dòng' }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { line?: LineIn } | null;
  if (!body?.line) return NextResponse.json({ error: 'Thiếu line' }, { status: 400 });
  const c = await cleanLine(body.line, slip.stage);
  if (c.error) return NextResponse.json({ error: c.error }, { status: 400 });
  const s = await ensureDraftSlip(slip.date, session!.fullName, slip.stage);
  if (s.error) return NextResponse.json({ error: s.error }, { status: 500 });
  const { error } = await supabaseAdmin.from('co_day_lines')
    .update({ ...c.row, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/co-days/lines/{id}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!canEditCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const { id } = await params;
  const slip = await slipOf(id);
  if (!slip) return NextResponse.json({ error: 'Không tìm thấy dòng' }, { status: 404 });
  const s = await ensureDraftSlip(slip.date, session!.fullName, slip.stage);
  if (s.error) return NextResponse.json({ error: s.error }, { status: 500 });
  const { error } = await supabaseAdmin.from('co_day_lines').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
