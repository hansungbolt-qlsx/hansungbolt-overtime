import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// POST /api/users/[id]/reactivate — đánh dấu lại "Đang làm"
// Set active=true + deactivated_at=NULL cho cả users + employees tương ứng
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { id } = await params;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, full_name, department, active')
    .eq('id', id)
    .maybeSingle();
  if (!user) {
    return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
  }
  if (user.active) {
    return NextResponse.json({ ok: true, message: 'User đã ở trạng thái đang làm' });
  }

  const { error: userErr } = await supabaseAdmin
    .from('users')
    .update({ active: true, deactivated_at: null })
    .eq('id', id);
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  if (user.department) {
    const { error: empErr } = await supabaseAdmin
      .from('employees')
      .update({ active: true, deactivated_at: null })
      .eq('full_name', user.full_name)
      .eq('department', user.department)
      .eq('active', false);
    if (empErr) {
      return NextResponse.json({
        ok: true,
        warning: `User đã khôi phục nhưng không cập nhật được employee: ${empErr.message}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
