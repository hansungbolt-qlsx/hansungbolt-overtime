import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// ============================================================
// Tồn kho Main do APP CHÍNH đẩy xuống (qua agent trên PC) để điện thoại có ô
// gợi ý mã + danh sách cuộn tick. GHI ĐÈ theo `part`, chỉ giữ bản mới nhất.
//
//   GET  /api/nvl-stock?part=nvl_main   → điện thoại đọc
//   POST /api/nvl-stock                 → agent đẩy lên
//                                         body {part, payload, n}
//
// part: nvl_main (cuộn kho Main) · nvl_line (cuộn đang ở line, dùng khi TRẢ kho)
//       nvl_master (master NVL) · aux (mã phụ liệu + tồn)
// ============================================================

const PARTS = ['nvl_main', 'nvl_line', 'nvl_master', 'aux'] as const;

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
  const { data, error } = await supabaseAdmin
    .from('nvl_stock_snapshot')
    .select('part, payload, n, pushed_at')
    .in('part', parts);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out: Record<string, unknown> = {};
  for (const row of data ?? []) {
    out[row.part] = { payload: row.payload, n: row.n, pushed_at: row.pushed_at };
  }
  return NextResponse.json({ ok: true, parts: out });
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
