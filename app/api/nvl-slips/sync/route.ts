import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// ============================================================
// Cầu nối cho AGENT trên PC (đăng nhập bằng tài khoản thật như print-agent).
//
//   GET  /api/nvl-slips/sync[?sweep=1][&before=YYYY-MM-DD]
//        → các phiếu cần đẩy sang app chính, kèm dòng.
//          sweep=1 (agent vét 16:30 + sáng hôm sau): lấy CẢ phiếu 'draft' mà
//          nhân viên quên bấm Gửi — user chốt cơ chế gửi kép chống quên.
//          before=YYYY-MM-DD: vét CHỈ phiếu nháp có slip_date TRƯỚC ngày này.
//          Dùng cho vét KHỞI ĐỘNG (user chốt 30/7): agent restart giữa ngày
//          (deploy…) không được gửi sớm phiếu nháp CỦA CHÍNH HÔM ĐÓ — đã dính
//          2 lần (29/7 phiếu 42 dòng, 30/7 phiếu 30 dòng) làm tách phiếu.
//
//   POST /api/nvl-slips/sync
//        → agent ghi ngược kết quả từ app chính:
//          {uid, status, line_errors?, main_refs?, reject_reason?, approved_at?,
//           approved_by?, error?}
// ============================================================

function agentAllowed(role: string): boolean {
  return role === 'admin' || role === 'qlsx';
}

/** So sánh JSON KHÔNG phụ thuộc thứ tự khoá.
 *  ⚠ Postgres `jsonb` sắp lại khoá khi lưu (id/no/url/type/…), còn app chính gửi
 *  theo thứ tự của nó → JSON.stringify thẳng thì LÚC NÀO CŨNG khác nhau. */
function canon(v: unknown): string {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === 'object') {
      return Object.fromEntries(
        Object.keys(x as Record<string, unknown>).sort()
          .map((k) => [k, walk((x as Record<string, unknown>)[k])]),
      );
    }
    return x;
  };
  return JSON.stringify(walk(v ?? null));
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!agentAllowed(session.role)) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const url = new URL(req.url);
  const sweep = url.searchParams.get('sweep') === '1';
  const beforeRaw = url.searchParams.get('before') ?? '';
  const before = /^\d{4}-\d{2}-\d{2}$/.test(beforeRaw) ? beforeRaw : '';

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
    // Vét 16:30 + sáng bật PC: gom cả phiếu nhân viên quên bấm Gửi
    // ⚠ CHỈ vét phiếu draft CHƯA TỪNG ĐẨY (synced_at IS NULL). Phiếu quay về
    // draft vì app chính XOÁ phiếu thật thì `synced_at` vẫn còn → agent KHÔNG tự
    // gửi lại. Bắt buộc có người bấm Gửi (lúc đó POST /api/nvl-slips xoá
    // synced_at). Thiếu chốt này thì 16:30 agent tự gửi lại phiếu vừa bị xoá và
    // tồn có thể bị trừ LẦN HAI.
    let q = base().eq('status', 'draft').is('synced_at', null);
    if (before) q = q.lt('slip_date', before);   // vét khởi động: chỉ ngày TRƯỚC
    const { data: drafts, error: dErr } = await q.order('slip_date').order('seq');
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
    slips = [...slips, ...(drafts ?? [])];
  }
  if (!slips || slips.length === 0) return NextResponse.json({ ok: true, slips: [] });

  // ══ TRẦN 1.000 DÒNG CỦA POSTGREST — CẮT ÂM THẦM (đo 14/08/2026) ══════════
  //
  // Đo thật trên chính dự án này: bảng `daily_plans` có 1.961 dòng, một lệnh
  // select không điều kiện trả về ĐÚNG 1.000 dòng — không lỗi, không cờ báo.
  // `limit=2000` và `Range: 0-4999` đều KHÔNG vượt được: trần đặt ở máy chủ
  // Supabase chứ không phải mặc định của thư viện.
  //
  // Ở riêng chỗ này trần đó nguy hiểm: dòng bị cắt ⇒ agent đẩy sang app chính
  // một phiếu THIẾU DÒNG ⇒ `receive_slip` ghi đè phiếu chờ duyệt bằng bản ngắn
  // ⇒ duyệt xong TRỪ TỒN THIẾU. Đúng hình dạng thiệt hại 13/08 (mất 27 dòng /
  // 7.192 Kg), chỉ khác cửa vào.
  //
  // Hàng đợi thực tế còn rất xa trần (đo 14/08: 0 phiếu chờ; 464 dòng cho TOÀN
  // BỘ 34 phiếu từ trước tới nay) ⇒ đây là chốt PHÒNG XA. Nhưng nó gần như miễn
  // phí: `count` về ngay trong lần gọi này, không thêm chuyến nào.
  const { data: lines, error: lErr, count } = await supabaseAdmin
    .from('nvl_slip_lines')
    .select('*', { count: 'exact' })
    .in('slip_id', slips.map((s) => s.id))
    .order('seq_no');
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
  if (count != null && count !== (lines?.length ?? 0)) {
    // THÀ KHÔNG ĐẨY GÌ còn hơn đẩy phiếu thiếu dòng. Trả lỗi ⇒ agent không nhận
    // được phiếu nào ⇒ `synced_at` của mọi phiếu vẫn NULL ⇒ không phiếu nào rời
    // hàng đợi, vòng sau đẩy lại đầy đủ.
    return NextResponse.json({
      error: `Máy chủ chỉ trả ${lines?.length ?? 0}/${count} dòng (trần 1.000 của Supabase) `
           + '— KHÔNG đẩy phiếu nào để khỏi mất dòng. Cần duyệt bớt phiếu đang chờ.',
      code: 'LINES_TRUNCATED',
    }, { status: 500 });
  }

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
        reason: l.reason ?? null,   // lý do trả kho theo dòng (migration 18)
        // Ngày xuất thực tế của dòng đến từ phiếu xuất tạm (migration 22).
        // App chính soi cảnh báo KHSX theo ngày này thay vì ngày phiếu, và tự
        // sinh ghi chú "Xuất thực tế dd/mm" in lên phiếu Q402-02.
        real_date: l.real_date ?? null,
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

  // ══ GIỮ PHIẾU TRONG HÀNG ĐỢI KHI APP CHÍNH LỖI TẠM THỜI (rà soát 14/08/2026) ══
  //
  // `synced_at` trước đây đóng dấu ở MỌI lượt ghi ngược — kể cả lượt agent gọi
  // CHỈ để báo lỗi. Mà `synced_at IS NULL` chính là điều kiện duy nhất giữ phiếu
  // trong hàng đợi (xem GET ở trên). Ghép hai điều đó lại:
  //
  //   app chính trả 500  →  agent gọi lượt "báo lỗi"  →  đóng dấu đã-đồng-bộ
  //   →  phiếu RỜI HÀNG ĐỢI VĨNH VIỄN
  //   →  điện thoại vẫn hiện 'đã gửi' + dòng đỏ, app chính KHÔNG HỀ CÓ phiếu
  //   →  tồn không bao giờ bị trừ, không cổng nào báo.
  //
  // `app/routers/ot_api.py:70` bắt MỌI ngoại lệ ngoài ValueError → 500, nên cửa
  // này mở với bất kỳ trục trặc nhất thời nào của app chính (khoá CSDL, hết bộ
  // nhớ, lỗi lạ trong build_preview…).
  //
  // ⚠ Đo 14/08/2026 trước khi vá: 34/34 phiếu ở Supabase đều CÓ MẶT bên app
  //   chính, 0 phiếu mang lỗi seq=0 ⇒ lỗ hổng này CHƯA TỪNG CẮN. Vá vì cơ chế
  //   sai, không phải vì đã mất dữ liệu — và vì nó mất im lặng nếu cắn.
  //
  // Lỗi NGHIỆP VỤ (422 — "phiếu đã duyệt rồi") vẫn đóng dấu như cũ: đẩy lại bao
  // nhiêu lần cũng nhận đúng câu trả lời đó, giữ lại chỉ tổ quay vòng vô ích.
  const keepQueued = body.keep_queued === true;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (!keepQueued) patch.synced_at = new Date().toISOString();
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
    canon(cur.main_refs ?? []) === canon(body.main_refs ?? []) &&
    (cur.reject_reason ?? null) === (body.reject_reason ?? null) &&
    canon(cur.line_errors ?? []) === canon(patch.line_errors ?? cur.line_errors ?? []);
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
