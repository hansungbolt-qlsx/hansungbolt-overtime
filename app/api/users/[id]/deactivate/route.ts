import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// POST /api/users/[id]/deactivate — đánh dấu user + employee tương ứng là "Đã nghỉ"
// - Không xóa dữ liệu, chỉ set active=false + deactivated_at=now()
// - User không login được + không hiện trong dropdown khi đăng ký tăng ca
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: 'Không thể tự đánh dấu nghỉ tài khoản đang đăng nhập' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, full_name, department, role, active')
    .eq('id', id)
    .maybeSingle();
  if (!user) {
    return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
  }
  if (user.role === 'admin') {
    return NextResponse.json({ error: 'Không thể đánh dấu nghỉ tài khoản admin' }, { status: 400 });
  }
  if (!user.active) {
    return NextResponse.json({ ok: true, message: 'User đã ở trạng thái nghỉ' });
  }

  const now = new Date().toISOString();

  // 1. Set user inactive
  const { error: userErr } = await supabaseAdmin
    .from('users')
    .update({ active: false, deactivated_at: now })
    .eq('id', id);
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  // 2. Set employee (cùng tên + cùng dept) inactive
  if (user.department) {
    const { error: empErr } = await supabaseAdmin
      .from('employees')
      .update({ active: false, deactivated_at: now })
      .eq('full_name', user.full_name)
      .eq('department', user.department)
      .eq('active', true);
    if (empErr) {
      // Đã update user thành công, employee fail → cảnh báo, không rollback
      return NextResponse.json({
        ok: true,
        warning: `User đã nghỉ nhưng không cập nhật được employee: ${empErr.message}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
