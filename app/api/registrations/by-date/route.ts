import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/registrations/by-date?date=YYYY-MM-DD
// Danh sách id phiếu tăng ca của 1 ngày — cho print-agent in gộp HD + RL
// trong 1 lệnh (type overtime_sheets, user 15/7). CHỈ ADMIN (agent là admin).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ admin' }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date phải là YYYY-MM-DD' }, { status: 400 });
  }

  // HD in trước RL (alphabet trùng ý user), cùng bộ phận thì phiếu gửi trước in trước
  const { data, error } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department, created_at')
    .eq('overtime_date', date)
    .order('department', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    registrations: (data ?? []).map((r) => ({ id: r.id, department: r.department })),
  });
}
