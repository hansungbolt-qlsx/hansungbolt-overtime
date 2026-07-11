import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { expireStalePrintJobs } from '@/lib/print-jobs-expire';

export const runtime = 'nodejs';

// GET /api/print-jobs/mine — leader / admin xem các job in gần đây của mình
// Trả về 20 job gần nhất (mọi status) — để UI hiển thị badge realtime
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  // Nút In poll endpoint này mỗi 3s khi theo dõi → job quá 2 phút được dọn
  // tại đây kể cả khi agent tắt hẳn, UI báo "lệnh đã tự hủy" đúng thời điểm.
  await expireStalePrintJobs();

  const { data, error } = await supabaseAdmin
    .from('print_jobs')
    .select('id, type, ref_id, status, created_at, started_at, finished_at, error_message')
    .eq('requested_by', session.userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ jobs: [], warning: error.message });
  }
  return NextResponse.json({ jobs: data ?? [] });
}
