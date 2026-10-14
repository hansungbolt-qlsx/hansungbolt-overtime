import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { GC_GUONG_BUCKET, GC_GUONG_PATH, canUseGiaCong } from '@/lib/gia-cong';

export const runtime = 'nodejs';

// Danh sách cho màn Gia công (anh Hữu 14/10/2026): nhà gia công theo công đoạn · chỉ thị chờ đặt · thùng chờ về.
// Agent đẩy THẲNG Storage (không qua route này) và chỉ khi dữ liệu đổi; điện thoại tải 1 lần khi mở màn
// (≈ 60–70 KB), giữ 5 phút ⇒ ít lượt Vercel nhất.
export async function GET() {
  const session = await getSession();
  if (!session || !canUseGiaCong(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const { data, error } = await supabaseAdmin.storage.from(GC_GUONG_BUCKET).download(GC_GUONG_PATH);
  if (error || !data) {
    return NextResponse.json({ ncc: [], cho_dat: [], cho_ve: [], error: 'Chưa có danh sách (agent chưa đẩy)' });
  }
  return new NextResponse(await data.text(), {
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
  });
}
