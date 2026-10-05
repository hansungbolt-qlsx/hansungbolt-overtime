import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Vercel cron — xoá phiếu Sản lượng CO quá 30 ngày (anh Hữu 05/10/2026: app tăng ca chỉ giữ 30 ngày,
// app chính lưu vĩnh viễn). CHỈ xoá phiếu đã về app chính ('received'); phiếu chưa về giữ lại để không mất.
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('co_day_slips').delete().lt('work_date', cutoff).eq('status', 'received').select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cutoff, deleted: data?.length ?? 0 });
}
