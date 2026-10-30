import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { todayVN } from '@/lib/nvl-slips';

export const runtime = 'nodejs';

// Cảnh báo nhầm nguyên liệu (anh Hữu 30/10/2026) — xem lib/nvl-canh-bao.ts

// GET: thẻ đầu trang user HD. CHỈ ngày hôm nay (giờ VN) — không có thì trả row null,
// tuyệt đối không lấy ngày cũ (danh sách cũ = sai máy, dễ gây nhầm hơn).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (session.role !== 'admin' && session.department !== 'HD') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const date = todayVN();
  const { data, error } = await supabaseAdmin
    .from('nvl_canh_bao')
    .select('plan_date, built_at, snap_id, data')
    .eq('plan_date', date)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ date, row: null, error: error.message });
  }
  return NextResponse.json({ date, row: data ?? null });
}

// PUT: app chính đẩy sau khi đồng bộ KHSX (đăng nhập admin như /api/upload-plan).
// Ghi đè đúng ngày đó.
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chưa đăng nhập hoặc không có quyền' }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }
  const date = String(body.date ?? '');
  const builtAt = String(body.built_at ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !builtAt) {
    return NextResponse.json({ error: 'Thiếu ngày KHSX hoặc giờ tính' }, { status: 400 });
  }
  const data = {
    a: Array.isArray(body.a) ? body.a : [],
    b: Array.isArray(body.b) ? body.b : [],
    n: Number(body.n) || 0,
    snap_id: Number(body.snap_id) || null,
    loi: typeof body.loi === 'string' && body.loi ? body.loi : undefined,
  };
  const { error } = await supabaseAdmin.from('nvl_canh_bao').upsert(
    {
      plan_date: date,
      built_at: builtAt,
      snap_id: data.snap_id,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'plan_date' },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, date, n: data.n });
}
