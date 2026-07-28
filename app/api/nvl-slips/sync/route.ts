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

  // CHỈ trả phiếu CHƯA đẩy sang app chính (`synced_at IS NULL`).
  // Nếu không lọc, agent sẽ đẩy lại cùng 1 phiếu MỖI 60 GIÂY suốt thời gian nó
  // nằm chờ duyệt (đo thực tế 28/7: 1.440 lần/ngày) — tốn egress vô ích và ghi
  // đè liên tục bên app chính. Nhân viên sửa rồi lưu lại thì POST /api/nvl-slips
  // xoá `synced_at` → phiếu tự quay lại hàng đợi.
  const base = () =>
    supabaseAdmin
      .from('nvl_day_slips')
      .select('id, uid, slip_date, kind, branch, seq, status, note, created_by_name, sent_at');

  const { data: fresh, error } = await base()
    .eq('status', 'pending').is('synced_at', null)
    .order('slip_date').order('seq');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let slips = fresh ?? [];
  if (sweep) {
    // Vét 16:15 + sáng bật PC: gom cả phiếu nhân viên quên bấm Gửi
    // ⚠ CHỈ vét phiếu draft CHƯA TỪNG ĐẨY (synced_at IS NULL). Phiếu quay về
    // draft vì app chính XOÁ phiếu thật thì `synced_at` vẫn còn → agent KHÔNG tự
    // gửi lại. Bắt buộc có người bấm Gửi (lúc đó POST /api/nvl-slips xoá
    // synced_at). Thiếu chốt này thì 16:15 agent tự gửi lại phiếu vừa bị xoá và
    // tồn có thể bị trừ LẦN HAI.
    const { data: drafts, error: dErr } = await base()
      .eq('status', 'draft').is('synced_at', null)
      .order('slip_date').order('seq');
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
    slips = [...slips, ...(drafts ?? [])];
  }
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

  // Trạng thái HIỆN TẠI bên này — để bỏ qua lượt đẩy KHÔNG ĐỔI GÌ.
  // Bộ nhớ chống-trùng của agent nằm trong RAM nên cứ khởi động lại là nó đẩy
  // lại toàn bộ phiếu 7 ngày, mỗi lần ghi thêm 1 dòng nhật ký y hệt (đo 28/7:
  // 9 dòng trùng). Chốt ở đây thì agent đẩy bao nhiêu lần cũng không sinh rác.
  const { data: cur } = await supabaseAdmin
    .from('nvl_day_slips')
    .select('id, status, main_refs, reject_reason, line_errors')
    .eq('uid', uid).single();

  const patch: Record<string, unknown> = {
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  // 'draft' = app chính đã XOÁ phiếu thật → phiếu quay về "như chưa gửi" để nhân
  // viên kho kiểm lại rồi gửi lại (user chốt 28/7).
  const ALLOWED = ['draft', 'pending', 'approved', 'rejected'];
  if (typeof body.status === 'string' && ALLOWED.includes(body.status)) {
    patch.status = body.status;
  }
  if (Array.isArray(body.line_errors)) patch.line_errors = body.line_errors;
  if (Array.isArray(body.main_refs)) patch.main_refs = body.main_refs;
  if (body.reject_reason !== undefined) patch.reject_reason = body.reject_reason;
  // Cảnh báo hệ thống từ app chính (phiếu thật bị xoá/sửa) → hiện đỏ trên điện
  // thoại qua line_errors, khỏi phải thêm cột mới bên Supabase.
  if (typeof body.sys_note === 'string' && body.sys_note) {
    patch.line_errors = [{ seq: 0, error: body.sys_note }];
  }
  if (body.approved_at !== undefined) patch.approved_at = body.approved_at;
  if (body.approved_by !== undefined) patch.approved_by = body.approved_by;
  if (body.sent_at !== undefined) patch.sent_at = body.sent_at;

  const { data, error } = await supabaseAdmin
    .from('nvl_day_slips').update(patch).eq('uid', uid).select('id, status').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Chỉ ghi nhật ký khi app chính CHỐT (duyệt / từ chối) VÀ có gì đó thực sự đổi
  // so với lần đẩy trước — tránh rác mỗi lần agent khởi động lại.
  const same =
    cur != null &&
    cur.status === body.status &&
    JSON.stringify(cur.main_refs ?? []) === JSON.stringify(body.main_refs ?? []) &&
    (cur.reject_reason ?? null) === (body.reject_reason ?? null) &&
    JSON.stringify(cur.line_errors ?? []) === JSON.stringify(patch.line_errors ?? cur.line_errors ?? []);
  if (!same
      && (body.status === 'approved' || body.status === 'rejected' || body.status === 'draft')) {
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
