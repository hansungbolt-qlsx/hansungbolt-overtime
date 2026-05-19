import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const PROFILE = 'default'; // chỉ 1 bé chơi

async function requireQlsx() {
  const session = await getSession();
  if (!session || session.username !== 'qlsx') return null;
  return session;
}

// GET → trả tiến độ. Nếu bảng chưa tạo (migration chưa chạy) → fallback:true
export async function GET() {
  const s = await requireQlsx();
  if (!s) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('game_progress')
    .select('stars, data')
    .eq('profile', PROFILE)
    .maybeSingle();

  if (error) {
    // Bảng chưa tồn tại / lỗi → client tự dùng localStorage
    return NextResponse.json({ fallback: true, stars: 0, data: {} });
  }
  return NextResponse.json({
    fallback: false,
    stars: data?.stars ?? 0,
    data: data?.data ?? {},
  });
}

// POST { stars, data } → upsert. Lỗi (chưa migration) → fallback:true
export async function POST(req: Request) {
  const s = await requireQlsx();
  if (!s) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.stars !== 'number') {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('game_progress')
    .upsert(
      {
        profile: PROFILE,
        stars: body.stars,
        data: body.data ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile' },
    );

  if (error) {
    return NextResponse.json({ fallback: true });
  }
  return NextResponse.json({ ok: true });
}
