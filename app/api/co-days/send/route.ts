import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { canEditCoDay, isISODate } from '@/lib/co-day';

export const runtime = 'nodejs';

// POST /api/co-days/send { date } — "Gửi phiếu" cuối ngày: status → pending, agent đẩy sang app chính trong ≤ 60".
export async function POST(req: Request) {
  const session = await getSession();
  if (!canEditCoDay(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { date?: string } | null;
  if (!body || !isISODate(body.date)) return NextResponse.json({ error: 'Thiếu date' }, { status: 400 });
  const { data: slip } = await supabaseAdmin
    .from('co_day_slips').select('id').eq('work_date', body.date).maybeSingle();
  if (!slip) return NextResponse.json({ error: 'Ngày này chưa có dòng nào' }, { status: 400 });
  const { count } = await supabaseAdmin
    .from('co_day_lines').select('id', { count: 'exact', head: true }).eq('slip_id', slip.id);
  if (!count) return NextResponse.json({ error: 'Phiếu chưa có dòng nào' }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('co_day_slips')
    .update({ status: 'pending', sent_at: now, sent_by_name: session!.fullName, synced_at: null, last_error: null, updated_at: now })
    .eq('id', slip.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, n_lines: count });
}
