import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import {
  KINDS, BRANCHES, todayVN, nowVNTime, slipUid,
  type Kind, type Branch,
} from '@/lib/nvl-slips';

export const runtime = 'nodejs';

// ============================================================
// Phiếu Xuất / Trả kho NPL do nhân viên kho ghi trên điện thoại.
//
// ⚠ Ở đây KHÔNG có logic tồn kho. Tồn kho thật nằm ở APP CHÍNH; agent đẩy phiếu
// sang app chính, người duyệt bấm Duyệt thì tồn mới đổi. Xem
// hsb-material-app/docs/SPEC_OT_XUAT_TRA_KHO.md
//
//   GET  /api/nvl-slips?kind=issue&branch=nvl[&date=YYYY-MM-DD]
//        → phiếu của ngày đó (mới nhất) + dòng + lịch sử sửa
//   POST /api/nvl-slips
//        → lưu đè phiếu trong ngày (bản sau cùng thắng); send=true = gửi luôn
// ============================================================

function canUse(role: string): boolean {
  // Nhân viên kho dùng role 'qlsx' (user chốt: tài khoản phamvancuong)
  return role === 'qlsx' || role === 'admin';
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!canUse(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') as Kind;
  const branch = url.searchParams.get('branch') as Branch;
  if (!KINDS.includes(kind) || !BRANCHES.includes(branch)) {
    return NextResponse.json({ error: 'kind/branch không hợp lệ' }, { status: 400 });
  }
  const date = (url.searchParams.get('date') || todayVN()).slice(0, 10);

  // TẤT CẢ phiếu trong ngày của (loại, nhánh), seq tăng dần.
  // ⚠ Trước 28/7 chỉ trả phiếu seq lớn nhất → phiếu đã duyệt buổi sáng BIẾN MẤT
  // khỏi điện thoại ngay khi mở phiếu thứ hai. Ngày làm 3-4 đợt là không còn đối
  // chiếu được đã xuất bao nhiêu. Giờ trả hết, client tự tách lịch sử / đang soạn.
  const { data: slips, error } = await supabaseAdmin
    .from('nvl_day_slips')
    .select('*')
    .eq('slip_date', date)
    .eq('kind', kind)
    .eq('branch', branch)
    .order('seq', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!slips || slips.length === 0) {
    return NextResponse.json({
      date, kind, branch, slips: [], slip: null, lines: [], events: [],
    });
  }

  // Phiếu ĐANG SOẠN = phiếu seq lớn nhất (khớp đúng phiếu mà POST sẽ gộp vào)
  const latest = slips[slips.length - 1];

  const [{ data: allLines, error: lnErr }, { data: events }] = await Promise.all([
    supabaseAdmin
      .from('nvl_slip_lines')
      .select('*')
      .in('slip_id', slips.map((s) => s.id))
      .order('seq_no'),
    supabaseAdmin
      .from('nvl_slip_events')
      .select('at, actor, action, detail')
      .eq('slip_id', latest.id)
      .order('at', { ascending: false })
      .limit(30),
  ]);
  if (lnErr) return NextResponse.json({ error: lnErr.message }, { status: 500 });

  const bySlip = new Map<string, typeof allLines>();
  for (const l of allLines ?? []) {
    const arr = bySlip.get(l.slip_id);
    if (arr) arr.push(l);
    else bySlip.set(l.slip_id, [l]);
  }

  return NextResponse.json({
    date, kind, branch,
    slips: slips.map((s) => ({ slip: s, lines: bySlip.get(s.id) ?? [] })),
    // Giữ 3 khoá cũ cho tương thích (phiếu mới nhất)
    slip: latest,
    lines: bySlip.get(latest.id) ?? [],
    events: events ?? [],
  });
}

type LineIn = {
  batch_seq?: number;
  batch_time?: string;
  batch_user?: string;
  department?: string;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  coil_id?: number | null;
  coil_no?: string;
  lot_no?: string;
  qty?: number | string;
  unit?: string;
  note?: string;
  reason?: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!canUse(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body phải là JSON' }, { status: 400 });

  const kind = body.kind as Kind;
  const branch = body.branch as Branch;
  if (!KINDS.includes(kind) || !BRANCHES.includes(branch)) {
    return NextResponse.json({ error: 'kind/branch không hợp lệ' }, { status: 400 });
  }
  const date = String(body.date || todayVN()).slice(0, 10);
  const send = body.send === true;
  const rawLines: LineIn[] = Array.isArray(body.lines) ? body.lines : [];

  const lines = rawLines
    .map((l) => ({
      batch_seq: Math.max(1, Number(l.batch_seq) || 1),
      batch_time: (l.batch_time || nowVNTime()).slice(0, 5),
      batch_user: (l.batch_user || session.fullName || session.username).slice(0, 64),
      department: l.department === 'Rolling' ? 'Rolling' : 'Heading',
      material_code: String(l.material_code || '').trim(),
      material_name: (l.material_name || '').slice(0, 255) || null,
      material_spec: (l.material_spec || '').slice(0, 128) || null,
      coil_id: l.coil_id != null && Number(l.coil_id) > 0 ? Number(l.coil_id) : null,
      coil_no: (l.coil_no || '').trim() || null,
      lot_no: (l.lot_no || '').trim() || null,
      qty: Math.max(0, Number(l.qty) || 0),
      unit: (l.unit || (branch === 'nvl' ? 'KG' : 'EA')).slice(0, 16),
      note: (l.note || '').slice(0, 255) || null,
      // Lý do CHỈ có ý nghĩa với phiếu TRẢ kho (user chốt 29/7). Phiếu xuất kho
      // gửi kèm cũng bị bỏ, tránh dữ liệu rác.
      reason: kind === 'return' ? ((l.reason || '').trim().slice(0, 255) || null) : null,
    }))
    .filter((l) => l.material_code || l.coil_id);

  if (lines.length === 0) {
    return NextResponse.json({ error: 'Phiếu phải có ít nhất 1 dòng' }, { status: 400 });
  }

  // Tìm phiếu để GỘP VÀO (user chốt: ưu tiên thêm vào phiếu đã có trong ngày).
  // Chỉ phiếu ĐÃ DUYỆT mới buộc mở phiếu mới với seq kế tiếp.
  const { data: existing, error: exErr } = await supabaseAdmin
    .from('nvl_day_slips')
    .select('id, uid, seq, status')
    .eq('slip_date', date)
    .eq('kind', kind)
    .eq('branch', branch)
    .order('seq', { ascending: false })
    .limit(1);
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

  const prev = existing?.[0] ?? null;
  const reuse = prev && prev.status !== 'approved';
  const seq = reuse ? prev!.seq : (prev ? prev.seq + 1 : 1);
  const uid = reuse ? prev!.uid : slipUid(date, kind, branch, seq);

  const patch = {
    uid,
    slip_date: date,
    kind,
    branch,
    seq,
    status: send ? 'pending' : 'draft',
    note: (body.note || '').slice(0, 1000) || null,
    created_by: session.userId,
    created_by_name: session.fullName || session.username,
    sent_at: send ? new Date().toISOString() : null,
    // Xoá dấu đã-đồng-bộ → agent nhặt lại phiếu này ở vòng poll kế tiếp.
    // (Có cái này thì /sync mới lọc được phiếu đã đẩy, khỏi đẩy lại mỗi 60s.)
    synced_at: null,
    // Gửi lại = xoá kết quả cũ, chờ app chính chấm lại
    reject_reason: null,
    approved_at: null,
    approved_by: null,
    main_refs: [],
    line_errors: [],
    updated_at: new Date().toISOString(),
  };

  let slipId: string;
  if (reuse) {
    const { error } = await supabaseAdmin
      .from('nvl_day_slips').update(patch).eq('id', prev!.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    slipId = prev!.id;
    await supabaseAdmin.from('nvl_slip_lines').delete().eq('slip_id', slipId);
  } else {
    const { data, error } = await supabaseAdmin
      .from('nvl_day_slips').insert(patch).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    slipId = data.id;
  }

  const { error: linErr } = await supabaseAdmin.from('nvl_slip_lines').insert(
    lines.map((l, i) => ({ ...l, slip_id: slipId, seq_no: i + 1 })),
  );
  if (linErr) return NextResponse.json({ error: linErr.message }, { status: 500 });

  // Nhật ký sửa — user chốt: lịch sử nằm ở app tăng ca vì bên app chính chỉ xem
  await supabaseAdmin.from('nvl_slip_events').insert({
    slip_id: slipId,
    slip_uid: uid,
    actor: session.fullName || session.username,
    action: send ? 'send' : 'save',
    detail: {
      n_lines: lines.length,
      n_batches: new Set(lines.map((l) => l.batch_seq)).size,
      total_qty: Number(lines.reduce((s, l) => s + l.qty, 0).toFixed(3)),
    },
  });

  return NextResponse.json({
    ok: true, slip_id: slipId, uid, seq,
    status: patch.status, n_lines: lines.length,
    new_slip: !reuse && !!prev,
  });
}
