import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const BUCKET = 'plan-files';
const PATH = 'dccd-lots.json';

// Catalog chỉ thị đang mở từ app chính (agent đẩy mỗi 10 phút) — nguồn gợi ý
// "In phiếu DCCD theo mã hàng" cho tổ trưởng (user 13/7).

// POST — agent (đăng nhập admin qlsx) đẩy catalog
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.lots)) {
    return NextResponse.json({ error: 'Body phải có lots[]' }, { status: 400 });
  }
  const payload = JSON.stringify({ lots: body.lots.slice(0, 1000), at: body.at ?? null });
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(PATH, Buffer.from(payload, 'utf8'), {
      contentType: 'application/json',
      upsert: true,
      cacheControl: '0',
    });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: body.lots.length });
}

// GET — leader/admin lấy catalog cho ô gợi ý (client filter tại chỗ)
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'leader')) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(PATH);
  if (error || !data) {
    return NextResponse.json(
      { lots: [], at: null, warning: 'Chưa có catalog — agent chưa đẩy lần nào' },
      { status: 200 },
    );
  }
  const text = await data.text();
  return new NextResponse(text, {
    headers: { 'Content-Type': 'application/json' },
  });
}
