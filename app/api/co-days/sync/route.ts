import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { vnToday } from '@/lib/co-day';

export const runtime = 'nodejs';

// Cầu nối AGENT (đăng nhập admin như print-agent) — Sản lượng CO (anh Hữu 05/10/2026).
//   GET  → phiếu cần đẩy sang app chính: status 'pending' chưa đẩy (synced_at NULL)
//          + phiếu 'draft' của NGÀY TRƯỚC hôm nay mà quên Gửi (vét bù, như kho NPL). Hôm nay chỉ gửi khi bấm Gửi.
//   POST → agent ghi kết quả: { uid, ok, main_ref?, error? }
function agentAllowed(role: string) {
  return role === 'admin' || role === 'qlsx';
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!agentAllowed(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const cols = 'id, uid, work_date, status, note, sent_by_name, created_by_name';
  const [{ data: pend, error: e1 }, { data: old, error: e2 }] = await Promise.all([
    supabaseAdmin.from('co_day_slips').select(cols).eq('status', 'pending').is('synced_at', null).order('work_date'),
    supabaseAdmin.from('co_day_slips').select(cols).eq('status', 'draft').lt('work_date', vnToday()).order('work_date'),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });
  const slips = [...(pend ?? []), ...(old ?? [])];
  const out = [];
  for (const s of slips) {
    const { data: lines, error } = await supabaseAdmin
      .from('co_day_lines')
      .select('seq_no, machine, lot_no, lot_label, vendor, saeji, item_code, item_name, lot_weight_kg, weight_kg, lot_qty, employee_name, note, matched, created_by_name')
      .eq('slip_id', s.id).order('seq_no');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!lines || lines.length === 0) continue;       // phiếu rỗng (xoá hết dòng) — không đẩy
    out.push({ ...s, sent_by_name: s.sent_by_name ?? s.created_by_name, swept: s.status === 'draft', lines });
  }
  return NextResponse.json({ slips: out });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!agentAllowed(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { uid?: string; ok?: boolean; main_ref?: string; error?: string } | null;
  if (!b?.uid) return NextResponse.json({ error: 'Thiếu uid' }, { status: 400 });
  const now = new Date().toISOString();
  const upd = b.ok
    ? { status: 'received', synced_at: now, received_at: now, main_ref: b.main_ref ?? null, last_error: null, updated_at: now }
    : { synced_at: null, last_error: (b.error ?? 'lỗi không rõ').slice(0, 500), updated_at: now };
  const { error } = await supabaseAdmin.from('co_day_slips').update(upd).eq('uid', b.uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
