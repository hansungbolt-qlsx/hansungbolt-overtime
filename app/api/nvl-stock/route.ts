import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// ============================================================
// Tồn kho Main do APP CHÍNH đẩy xuống (qua agent trên PC) để điện thoại có ô
// gợi ý mã + danh sách cuộn tick. GHI ĐÈ theo `part`, chỉ giữ bản mới nhất.
//
//   GET  /api/nvl-stock?part=nvl_main         → điện thoại đọc (kèm dữ liệu)
//   GET  /api/nvl-stock?part=...&meta=1       → CHỈ mốc thời gian + số mục (~100 B)
//   POST /api/nvl-stock                       → agent đẩy lên
//                                               body {part, payload, n}
//
// ⚠ QUY ĐỊNH (user chốt 28/7 tối): điện thoại CHỈ tải lại khi tồn ĐÃ BIẾN ĐỘNG.
// Trước đây mỗi lần mở màn là tải nguyên gói (xuất kho 133 KB, trả kho 316 KB)
// dù tồn y nguyên. Nay điện thoại hỏi `meta` trước — trùng mốc `pushed_at` đã
// lưu thì dùng bản trong máy, không tải gì.
//
// part: nvl_main (cuộn kho Main) · nvl_line (cuộn đang ở line, dùng khi TRẢ kho)
//       nvl_master (master NVL) · aux (mã phụ liệu + tồn)
//       nvl_khsx (mã NVL trong KHSX hôm nay — cảnh báo xuất ngoài kế hoạch, 30/7)
// ============================================================

const PARTS = ['nvl_main', 'nvl_line', 'nvl_master', 'aux', 'nvl_khsx'] as const;

// ============================================================
// NHỊP TIM CỦA AGENT — anh Hữu chốt 21/08/2026
//
// Vì sao KHÔNG đo tuổi của `pushed_at`: agent CHỈ đẩy tồn khi tồn ĐỔI
// (`if (version === lastStockVersion && !heavyDue) return;`). Sáng vắng việc thì
// `pushed_at` cũ hàng giờ một cách HỢP LỆ ⇒ báo theo tuổi dữ liệu là báo động
// giả, mà báo giả nhiều lần thì "đỏ mất thiêng". Anh Hữu đã bác đúng đề nghị
// sai này của Claude ngày 20/08.
//
// Cái đo được thật: agent ghi đè file catalog DCCD **mỗi 10 phút, VÔ ĐIỀU KIỆN**
// (`pushDccdCatalog` trong print-agent/agent.js — không có nhánh "không đổi thì
// thôi"). Vậy thời điểm sửa file đó CHÍNH LÀ nhịp tim, độ phân giải 10 phút,
// KHÔNG phải sửa agent lấy một dòng, KHÔNG thêm lượt ghi nào.
//
// Nhịp tim tắt cũng có nghĩa app chính không với tới được (`pushDccdCatalog` gọi
// app chính trước) — mà app chính chết thì tồn cũng không đẩy được ⇒ vẫn là
// báo ĐÚNG, không phải báo thừa.
// ============================================================
async function nhipTimAgent(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.storage
      .from('plan-files')
      .list('', { search: 'dccd-lots.json', limit: 1 });
    const f = data?.find((o) => o.name === 'dccd-lots.json');
    return (f?.updated_at as string | undefined) ?? null;
  } catch {
    return null;   // hỏi hỏng → coi như KHÔNG BIẾT, client tự xử (không báo bừa)
  }
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (session.role !== 'qlsx' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const url = new URL(req.url);
  const parts = (url.searchParams.get('part') || '')
    .split(',').map((s) => s.trim()).filter((s) => (PARTS as readonly string[]).includes(s));
  if (parts.length === 0) {
    return NextResponse.json({ error: 'Thiếu part' }, { status: 400 });
  }
  // meta=1 → KHÔNG kèm payload. Truy vấn cũng không select payload nên gói tồn
  // không rời khỏi Supabase (tiết kiệm cả băng thông lẫn thời gian mở màn).
  const metaOnly = url.searchParams.get('meta') === '1';
  const tbl = supabaseAdmin.from('nvl_stock_snapshot');
  // Nhịp tim đi kèm CHÍNH lượt hỏi mốc đã có ⇒ không thêm lượt Vercel nào.
  // Chỉ hỏi ở lượt `meta` (lượt tải gói nặng không cần, tránh việc thừa).
  const [{ data, error }, agentAt] = await Promise.all([
    metaOnly
      ? tbl.select('part, n, pushed_at').in('part', parts)
      : tbl.select('part, payload, n, pushed_at').in('part', parts),
    metaOnly ? nhipTimAgent() : Promise.resolve(null),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out: Record<string, unknown> = {};
  for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    out[row.part as string] = metaOnly
      ? { n: row.n, pushed_at: row.pushed_at }
      : { payload: row.payload, n: row.n, pushed_at: row.pushed_at };
  }
  return NextResponse.json({ ok: true, meta: metaOnly, parts: out, agent_at: agentAt });
}

export async function POST(req: Request) {
  // Agent đăng nhập bằng tài khoản thật (giống /api/dccd-lots) → có session cookie
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (session.role !== 'admin' && session.role !== 'qlsx') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const part = body?.part;
  if (!body || !(PARTS as readonly string[]).includes(part)) {
    return NextResponse.json({ error: 'part không hợp lệ' }, { status: 400 });
  }
  const payload = body.payload ?? [];
  const { error } = await supabaseAdmin.from('nvl_stock_snapshot').upsert(
    {
      part,
      payload,
      n: Number(body.n) || (Array.isArray(payload) ? payload.length : 0),
      pushed_at: new Date().toISOString(),
    },
    { onConflict: 'part' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, part });
}
