import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { CO_MACHINES, canEditCoDay, canUseCoDay, isISODate } from '@/lib/co-day';
import { LINE_COLS, cleanLine, ensureDraftSlip, type LineIn } from '@/lib/co-day-server';

export const runtime = 'nodejs';

// GET /api/co-days?date=YYYY-MM-DD → { slip, lines, employees } — Sản lượng CO hàng ngày (anh Hữu 05/10/2026)
export async function GET(req: Request) {
  const session = await getSession();
  if (!canUseCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const date = new URL(req.url).searchParams.get('date');
  if (!isISODate(date)) return NextResponse.json({ error: 'Sai date (YYYY-MM-DD)' }, { status: 400 });

  const [{ data: slip, error: e1 }, { data: emps, error: e2 }] = await Promise.all([
    supabaseAdmin
      .from('co_day_slips')
      .select('id, uid, work_date, status, sent_at, sent_by_name, received_at, last_error')
      .eq('work_date', date)
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
  return NextResponse.json({ date, slip: slip ?? null, lines, employees: emps ?? [], machines: CO_MACHINES });
}

// POST /api/co-days  { date, line } → thêm 1 dòng
export async function POST(req: Request) {
  const session = await getSession();
  if (!canEditCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { date?: string; line?: LineIn } | null;
  if (!body || !isISODate(body.date) || !body.line) {
    return NextResponse.json({ error: 'Thiếu date hoặc line' }, { status: 400 });
  }
  const c = await cleanLine(body.line);
  if (c.error) return NextResponse.json({ error: c.error }, { status: 400 });
  const s = await ensureDraftSlip(body.date, session!.fullName);
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

// DELETE /api/co-days?date=YYYY-MM-DD — xoá CẢ phiếu ngày (anh Hữu 05/10/2026).
// Phiếu đang ở app chính ('received' hoặc đang chờ đẩy) thì CHẶN: xoá trên app chính trước (TV › Kết quả Coating),
// phiếu tự trả về đây rồi mới xoá — để 2 bên không lệch nhau.
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!canEditCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const date = new URL(req.url).searchParams.get('date');
  if (!isISODate(date)) return NextResponse.json({ error: 'Sai date (YYYY-MM-DD)' }, { status: 400 });
  const { data: slip } = await supabaseAdmin.from('co_day_slips').select('id, status').eq('work_date', date).maybeSingle();
  if (!slip) return NextResponse.json({ error: 'Ngày này không có phiếu' }, { status: 404 });
  if (slip.status !== 'draft') {
    return NextResponse.json({ error: slip.status === 'received'
      ? 'Phiếu đang ở app chính — nhờ admin xoá trên app chính (TV › Kết quả Coating) trước, phiếu sẽ trả về đây'
      : 'Phiếu đang chờ đẩy sang app chính — đợi khoảng 1 phút rồi thử lại' }, { status: 409 });
  }
  const { error } = await supabaseAdmin.from('co_day_slips').delete().eq('id', slip.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
