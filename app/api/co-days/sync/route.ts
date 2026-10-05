import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { vnToday } from '@/lib/co-day';

export const runtime = 'nodejs';

// Cầu nối AGENT (đăng nhập admin như print-agent) — Sản lượng CO (anh Hữu 05/10/2026).
//   GET  → phiếu cần đẩy sang app chính: status 'pending' chưa đẩy (synced_at NULL)
//          + KHI agent gửi ?sweep=1: phiếu 'draft' của NGÀY TRƯỚC hôm nay mà quên Gửi (vét bù).
//          Agent chỉ vét lúc 07:00 sáng hôm sau hoặc lúc vừa khởi động (anh Hữu 05/10/2026: Coating tăng ca
//          tới 19:30, máy tính tắt sau 16:30 — không vét 16:30). Hôm nay chỉ gửi khi bấm Gửi.
//   POST → agent ghi kết quả: { uid, ok, main_ref?, error? }
function agentAllowed(role: string) {
  return role === 'admin' || role === 'qlsx';
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!agentAllowed(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const sweep = new URL(req.url).searchParams.get('sweep') === '1';
  const cols = 'id, uid, work_date, status, note, sent_by_name, created_by_name, last_error';
  const [{ data: pend, error: e1 }, { data: old, error: e2 }] = await Promise.all([
    supabaseAdmin.from('co_day_slips').select(cols).eq('status', 'pending').is('synced_at', null).order('work_date'),
    sweep
      ? supabaseAdmin.from('co_day_slips').select(cols).eq('status', 'draft').lt('work_date', vnToday()).order('work_date')
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });
  // Phiếu ngày cũ do APP CHÍNH XOÁ trả về thì KHÔNG tự vét gửi lại (anh Hữu 05/10/2026) — chỉ gửi khi người dùng bấm Gửi
  const oldOk = (old ?? []).filter((s) => !String((s as { last_error?: string | null }).last_error ?? '').startsWith('App chính đã xoá'));
  const slips = [...(pend ?? []), ...oldOk];
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
  const b = (await req.json().catch(() => null)) as { uid?: string; ok?: boolean; main_ref?: string; error?: string; returned?: boolean; returned_by?: string } | null;
  if (!b?.uid) return NextResponse.json({ error: 'Thiếu uid' }, { status: 400 });
  const now = new Date().toISOString();
  // App chính XOÁ phiếu (anh Hữu 05/10/2026) → trả về 'Đang ghi' + ghi chú; bên đây sửa rồi Gửi lại, hoặc Xoá phiếu cho sạch
  if (b.returned) {
    const { error } = await supabaseAdmin.from('co_day_slips').update({
      status: 'draft', synced_at: null, received_at: null, main_ref: null, updated_at: now,
      last_error: `App chính đã xoá phiếu${b.returned_by ? ` (${b.returned_by})` : ''} — sửa rồi Gửi lại, hoặc bấm Xoá phiếu ngày`,
    }).eq('uid', b.uid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const upd = b.ok
    ? { status: 'received', synced_at: now, received_at: now, main_ref: b.main_ref ?? null, last_error: null, updated_at: now }
    : { synced_at: null, last_error: (b.error ?? 'lỗi không rõ').slice(0, 500), updated_at: now };
  const { error } = await supabaseAdmin.from('co_day_slips').update(upd).eq('uid', b.uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
