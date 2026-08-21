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

// ============================================================
// CUỘN ĐANG BỊ GIỮ CHỖ — anh Hữu chốt 21/08/2026
//
// Sự cố 20/08: anh Giang duyệt phiếu 19/08 lúc 07:30 → cuộn MAN-12 bị trừ bên
// app chính. Bản chụp tồn trên điện thoại vẫn là bản CŨ (agent chưa được khởi
// động vì chưa ai đăng nhập máy) ⇒ 07:54 cuộn đó vẫn hiện ra và được tick lần
// hai. Trước đây điện thoại chỉ tự loại cuộn của phiếu CÙNG NGÀY, nên phiếu
// chờ duyệt của hôm trước không giữ được chỗ.
//
// BA LUẬT anh Hữu chốt:
//   1. Giữ chỗ cho phiếu CHƯA KHÉP = 'pending' + 'draft', MỌI NGÀY.
//      'approved' và 'rejected' phải THẢ CUỘN RA NGAY — phiếu bị từ chối là
//      phiếu chết, giữ luôn thì cuộn biến mất vĩnh viễn khỏi màn hình.
//   2. PostgREST cắt cứng 1.000 dòng và KHÔNG báo gì. Đếm chính xác rồi so:
//      lệch một dòng là KHÔNG GIẤU GÌ CẢ + báo đỏ. Thà hiện thừa (người duyệt
//      còn chặn được) hơn giấu nhầm (nhân viên không tài nào chọn được cuộn).
//   3. Client hiện dòng "N cuộn đang nằm ở phiếu chờ duyệt — không chọn được".
//
// Đi kèm trong CHÍNH lượt gọi GET này ⇒ KHÔNG tốn thêm lượt Vercel nào.
// ============================================================
async function cuonBiGiuCho(kind: Kind, branch: Branch): Promise<{
  ids: number[];
  partial: boolean;
}> {
  const CAP = 1000;   // trần cứng của PostgREST
  const { data: mo, count: nMo, error: e1 } = await supabaseAdmin
    .from('nvl_day_slips')
    .select('id', { count: 'exact' })
    .eq('kind', kind)
    .eq('branch', branch)
    .in('status', ['pending', 'draft']);
  // Hỏi hỏng → coi như KHÔNG BIẾT ⇒ không giấu gì, báo đỏ (luật 2).
  if (e1 || !mo) return { ids: [], partial: true };
  if (mo.length === 0) return { ids: [], partial: false };
  if ((nMo ?? mo.length) !== mo.length || mo.length >= CAP) {
    return { ids: [], partial: true };
  }

  const { data: dong, count: nDong, error: e2 } = await supabaseAdmin
    .from('nvl_slip_lines')
    .select('coil_id', { count: 'exact' })
    .in('slip_id', mo.map((s) => s.id))
    .not('coil_id', 'is', null);
  if (e2 || !dong) return { ids: [], partial: true };
  if ((nDong ?? dong.length) !== dong.length || dong.length >= CAP) {
    return { ids: [], partial: true };
  }

  const ids = [...new Set(dong.map((l) => l.coil_id as number))];
  return { ids, partial: false };
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
  const [{ data: slips, error }, giu] = await Promise.all([
    supabaseAdmin
      .from('nvl_day_slips')
      .select('*')
      .eq('slip_date', date)
      .eq('kind', kind)
      .eq('branch', branch)
      .order('seq', { ascending: true }),
    cuonBiGiuCho(kind, branch),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ⚠ Cuộn bị giữ chỗ PHẢI trả cả ở nhánh "hôm nay chưa có phiếu nào" — đúng
  // kịch bản sáng 20/08: hôm nay trắng phiếu, cuộn bị giữ nằm ở phiếu HÔM QUA.
  if (!slips || slips.length === 0) {
    return NextResponse.json({
      date, kind, branch, slips: [], slip: null, lines: [], events: [],
      held_coil_ids: giu.ids, held_partial: giu.partial,
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
    held_coil_ids: giu.ids, held_partial: giu.partial,
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
  // Ngày xuất THỰC TẾ — chỉ dòng đến từ PHIẾU XUẤT TẠM mới có (hàng về gấp, xuất
  // trước khi nhập kho, chốt vào phiếu ngày sau). App chính dùng để soi cảnh báo
  // KHSX theo đúng ngày sản xuất và tự ghi chú "Xuất thực tế dd/mm" lên phiếu.
  real_date?: string | null;
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
      // Chỉ nhận ngày dạng YYYY-MM-DD; rác thì bỏ (dòng thường luôn NULL).
      real_date: /^\d{4}-\d{2}-\d{2}$/.test(String(l.real_date || ''))
        ? String(l.real_date) : null,
    }))
    .filter((l) => l.material_code || l.coil_id);

  if (lines.length === 0) {
    return NextResponse.json({ error: 'Phiếu phải có ít nhất 1 dòng' }, { status: 400 });
  }

  // Tìm phiếu để GỘP VÀO — chỉ gộp khi phiếu CHƯA RỜI KHỎI TAY nhân viên kho.
  //
  // ⚠ ĐÃ GỬI (pending) thì KHÔNG gộp nữa (user chốt 29/7). Trước đây phiếu chờ
  // duyệt vẫn ghi đè được, sinh ra lỗ hổng: người duyệt mở màn Chờ duyệt đọc 2
  // dòng → nhân viên thêm 3 dòng rồi Gửi → phiếu thành 5 dòng → người duyệt bấm
  // Duyệt là TRỪ TỒN 5 DÒNG trong khi chỉ đọc 2. Màn người duyệt không tự làm
  // mới, khoảng cách gửi → duyệt thường vài tiếng.
  // Gửi nhầm muốn sửa: người duyệt bấm Từ chối → phiếu về 'rejected' → gộp lại
  // được. Mọi thay đổi sau khi gửi đều để lại dấu vết.
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
  const reuse = prev != null && (prev.status === 'draft' || prev.status === 'rejected');
  const seq = reuse ? prev!.seq : (prev ? prev.seq + 1 : 1);
  const uid = reuse ? prev!.uid : slipUid(date, kind, branch, seq);

  // ══ CHỐT PHIÊN BẢN — vá lỗi MẤT 27 DÒNG ngày 13/08/2026 ═══════════════════
  // Ca thật: phiếu `ot-2026-08-13-issue-nvl-1` có 30 dòng / 7.491 Kg lúc 10:35:19;
  // lần Lưu 10:46:53 đè xuống còn 3 dòng. Điện thoại lúc đó giữ rổ RỖNG (chứng
  // minh: 3 dòng mới mang `batch_seq = 1`, nếu rổ có 30 dòng thì phải là 12), mà
  // ngay dưới kia là `delete()` toàn bộ rồi `insert()` lại theo rổ đó.
  //
  // Rổ rỗng có thể do: đổi tab (component bị tháo dựng lại) · `loadSlip()` lỗi ·
  // gõ trước khi nạp xong · máy khác đang mở trang cũ. BA-BỐN lối, nhưng CHUNG
  // một cửa: máy chủ nhận rổ thiếu rồi xoá sạch. Chặn ở đây là chặn hết.
  //
  // Cách chặn: máy gửi kèm `base_n_lines` = số dòng nó NHẬN VỀ từ máy chủ ở lần
  // nạp gần nhất. Lệch với số dòng thật ⇒ TỪ CHỐI, KHÔNG xoá gì.
  //   · rổ rỗng vì nạp hỏng  → base 0  vs thật 30 → chặn
  //   · thêm dòng bình thường → base 19 vs thật 19 → cho qua
  //   · người dùng bấm ✕ xoá dòng → base vẫn 19, vẫn cho qua (xoá là cố ý)
  //   · hai máy cùng sửa      → máy sau lệch → chặn, bắt tải lại
  //
  // ⚠ BẮT BUỘC có `base_n_lines` khi gộp vào phiếu cũ. Cho qua khi thiếu thì lỗ
  // hổng vẫn mở với mọi tab đang mở bản cũ — mà thiệt hại một lần là 7.491 Kg.
  // Dòng đang có TRƯỚC khi ghi đè — dùng cho cả chốt phiên bản lẫn ảnh chụp
  // an toàn ở cuối hàm (xem "LƯỚI AN TOÀN").
  let truocKhiGhi: Array<Record<string, unknown>> = [];
  if (reuse) {
    const { data: dangCo, error: cntErr } = await supabaseAdmin
      .from('nvl_slip_lines')
      // ⚠ Phải là MỘT chuỗi literal — nối bằng `+` thì supabase-js không suy ra
      //   được kiểu, trả về GenericStringError[] và tsc báo lỗi.
      .select('batch_seq, batch_time, department, material_code, material_name, material_spec, coil_id, coil_no, lot_no, qty, unit, note, reason')
      .eq('slip_id', prev!.id)
      .order('seq_no');
    if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 });
    truocKhiGhi = dangCo ?? [];
    const count = truocKhiGhi.length;

    const base = Number(body.base_n_lines);
    if (!Number.isInteger(base) || base < 0) {
      return NextResponse.json({
        error: 'Máy đang chạy bản cũ nên chưa gửi được mốc đối chiếu. '
             + 'Vui lòng tải lại trang (F5) rồi lưu lại — phiếu trên máy chủ vẫn nguyên.',
        code: 'BASE_MISSING',
      }, { status: 409 });
    }
    if (count !== base) {
      return NextResponse.json({
        error: `Phiếu trên máy chủ đang có ${count} dòng, máy anh chỉ biết ${base} dòng. `
             + 'Chưa lưu gì cả để khỏi mất dòng — bấm Tải lại rồi ghi tiếp.',
        code: 'VERSION_MISMATCH',
        server_n_lines: count,
        client_base: base,
      }, { status: 409 });
    }
  }
  // ══════════════════════════════════════════════════════════════════════════

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

  // ⚠ AN TOÀN THỨ TỰ TRIỂN KHAI (31/7): ngay trên kia đã XOÁ SẠCH dòng cũ rồi mới
  // insert lại, mà hai lệnh này KHÔNG nằm trong cùng giao dịch. Nếu insert hỏng thì
  // phiếu mất trắng dòng. Cột `real_date` là cột MỚI (migration 22) — deploy trước
  // khi chạy migration là insert hỏng ngay, thổi bay phiếu đang soạn dở của kho.
  // Vì vậy: dòng nào KHÔNG có ngày xuất thực tế thì BỎ HẲN khoá đó khỏi bản ghi
  // (kết quả trong DB y hệt: cột mặc định NULL). Nhờ đó code mới chạy được cả trên
  // DB chưa migration — chỉ dòng đến từ phiếu xuất tạm mới cần cột đó, mà phiếu tạm
  // thì cũng chỉ tồn tại sau khi đã migration.
  const { error: linErr } = await supabaseAdmin.from('nvl_slip_lines').insert(
    lines.map((l, i) => {
      const { real_date, ...rest } = l;
      const row = { ...rest, slip_id: slipId, seq_no: i + 1 };
      return real_date ? { ...row, real_date } : row;
    }),
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
      // ══ LƯỚI AN TOÀN (13/08/2026) ═══════════════════════════════════════════
      // Chụp lại NỘI DUNG dòng CŨ khi lần lưu này làm phiếu NGẮN ĐI.
      //
      // Vì sao cần: ngày 13/08 nhật ký chỉ ghi 3 con số đếm, nên biết mất 27 dòng
      // mà KHÔNG biết mất cuộn nào. Cứu được 19/30 dòng chỉ nhờ bản chụp Supabase
      // 2 giờ/lần tình cờ chụp lúc 10:00 — 11 dòng rơi vào khe giữa hai lần chụp
      // thì mất vĩnh viễn (autovacuum dọn sau 14 giây).
      //
      // Vì sao CHỈ chụp khi ngắn đi, không chụp mọi lần:
      //   · thêm dòng thì trạng thái cũ là tập con của mới → không cần chụp
      //   · `detail` được điện thoại tải về ở mục Lịch sử (30 mục/lần); chụp mọi
      //     lần là mỗi lần mở màn tải thêm ~100 KB, đốt egress Supabase vô ích
      //   · đo trên lịch sử thật: chỉ 2 lần phiếu ngắn đi trong 33 phiếu
      // Chốt phiên bản ở trên đã chặn ca ngoài ý muốn; lưới này để dành cho ca
      // người dùng CỐ Ý xoá rồi tiếc, hoặc một lỗi khác mình chưa biết.
      ...(truocKhiGhi.length > lines.length ? { truoc: truocKhiGhi } : {}),
    },
  });

  return NextResponse.json({
    ok: true, slip_id: slipId, uid, seq,
    status: patch.status, n_lines: lines.length,
    new_slip: !reuse && !!prev,
  });
}
