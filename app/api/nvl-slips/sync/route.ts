import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// ============================================================
// Cầu nối cho AGENT trên PC (đăng nhập bằng tài khoản thật như print-agent).
//
//   GET  /api/nvl-slips/sync[?sweep=1]
//        → các phiếu cần đẩy sang app chính, kèm dòng.
//          sweep=1 (agent vét 16:15 + sáng hôm sau): lấy CẢ phiếu 'draft' mà
//          nhân viên quên bấm Gửi — user chốt cơ chế gửi kép chống quên.
//
//   POST /api/nvl-slips/sync
//        → agent ghi ngược kết quả từ app chính:
//          {uid, status, line_errors?, main_refs?, reject_reason?, approved_at?,
//           approved_by?, error?}
// ============================================================

function agentAllowed(role: string): boolean {
  return role === 'admin' || role === 'qlsx';
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!agentAllowed(session.role)) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const sweep = new URL(req.url).searchParams.get('sweep') === '1';
  const statuses = sweep ? ['pending', 'draft'] : ['pending'];

  const { data: slips, error } = await supabaseAdmin
    .from('nvl_day_slips')
    .select('id, uid, slip_date, kind, branch, seq, status, note, created_by_name, sent_at')
    .in('status', statuses)
    .order('slip_date')
    .order('seq');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!slips || slips.length === 0) return NextResponse.json({ ok: true, slips: [] });

  const { data: lines, error: lErr } = await supabaseAdmin
    .from('nvl_slip_lines')
    .select('*')
    .in('slip_id', slips.map((s) => s.id))
    .order('seq_no');
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  const byslip = new Map<string, typeof lines>();
  for (const l of lines ?? []) {
    if (!byslip.has(l.slip_id)) byslip.set(l.slip_id, []);
    byslip.get(l.slip_id)!.push(l);
  }

  return NextResponse.json({
    ok: true,
    slips: slips.map((s) => ({
      ...s,
      lines: (byslip.get(s.id) ?? []).map((l) => ({
        batch_seq: l.batch_seq,
        batch_time: l.batch_time,
        batch_user: l.batch_user,
        department: l.department,
        material_code: l.material_code,
        coil_id: l.coil_id,
        coil_no: l.coil_no,
        lot_no: l.lot_no,
        qty: Number(l.qty),
        unit: l.unit,
        note: l.note,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!agentAllowed(session.role)) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const uid = String(body?.uid || '').trim();
  if (!uid) return NextResponse.json({ error: 'Thiếu uid' }, { status: 400 });

  const patch: Record<string, unknown> = {
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const ALLOWED = ['pending', 'approved', 'rejected'];
  if (typeof body.status === 'string' && ALLOWED.includes(body.status)) {
    patch.status = body.status;
  }
  if (Array.isArray(body.line_errors)) patch.line_errors = body.line_errors;
  if (Array.isArray(body.main_refs)) patch.main_refs = body.main_refs;
  if (body.reject_reason !== undefined) patch.reject_reason = body.reject_reason;
  if (body.approved_at !== undefined) patch.approved_at = body.approved_at;
  if (body.approved_by !== undefined) patch.approved_by = body.approved_by;
  if (body.sent_at !== undefined) patch.sent_at = body.sent_at;

  const { data, error } = await supabaseAdmin
    .from('nvl_day_slips').update(patch).eq('uid', uid).select('id, status').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Chỉ ghi nhật ký khi app chính CHỐT (duyệt / từ chối) — tránh spam mỗi vòng poll
  if (body.status === 'approved' || body.status === 'rejected') {
    await supabaseAdmin.from('nvl_slip_events').insert({
      slip_id: data.id,
      slip_uid: uid,
      actor: body.approved_by || 'app chính',
      action: body.status,
      detail: {
        refs: body.main_refs ?? [],
        reason: body.reject_reason ?? null,
      },
    });
  }
  return NextResponse.json({ ok: true, status: data.status });
}
