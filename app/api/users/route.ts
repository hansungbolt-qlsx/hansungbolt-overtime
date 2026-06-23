import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const DEFAULT_PASSWORD = 'hd123';

// GET /api/users — list tất cả user (admin only)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  // SELECT * để forward-compat với DB chưa có cột `active`/`deactivated_at`
  // (trước migration 08). Bỏ password_hash trước khi trả về client.
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .order('role', { ascending: false })
    .order('department', { ascending: true })
    .order('full_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = (data ?? []).map((u) => {
    const { password_hash: _ph, ...rest } = u as Record<string, unknown> & { password_hash?: string };
    void _ph;
    return rest;
  });

  return NextResponse.json({ users });
}

// POST /api/users — tạo user mới (admin only)
// Body: { full_name, username, role: 'leader'|'worker', department: 'HD'|'RL' }
// Cùng lúc insert vào employees để user xuất hiện trong phiếu đăng ký tăng ca.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body không phải JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const fullName = typeof b.full_name === 'string' ? b.full_name.trim() : '';
  const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : '';
  const role = b.role;
  const department = b.department;

  if (!fullName) {
    return NextResponse.json({ error: 'Thiếu họ tên' }, { status: 400 });
  }
  if (!username || !/^[a-z0-9]+$/.test(username)) {
    return NextResponse.json(
      { error: 'Username chỉ chứa chữ thường (a-z) và số, không dấu, không khoảng trắng' },
      { status: 400 },
    );
  }
  if (role !== 'leader' && role !== 'worker') {
    return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 });
  }
  if (department !== 'HD' && department !== 'RL') {
    return NextResponse.json({ error: 'Bộ phận không hợp lệ' }, { status: 400 });
  }

  // Username trùng?
  const { data: existed } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existed) {
    return NextResponse.json({ error: `Username "${username}" đã tồn tại` }, { status: 409 });
  }

  const fullNameStored = fullName.toUpperCase();

  // 1. Insert vào users (password = hd123)
  const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const { data: newUser, error: userErr } = await supabaseAdmin
    .from('users')
    .insert({
      username,
      full_name: fullNameStored,
      role,
      department,
      password_hash,
      password_plain: DEFAULT_PASSWORD,
    })
    .select('id, username, full_name, role, department, password_plain, created_at')
    .single();

  if (userErr || !newUser) {
    return NextResponse.json(
      { error: userErr?.message ?? 'Không tạo được user' },
      { status: 500 },
    );
  }

  // 2. Nếu đã có employee cùng tên + dept và đang inactive → reactivate
  //    Nếu chưa có → tạo mới với order_no = max + 1
  // SELECT * để forward-compat với DB chưa có cột `active` (trước migration 08).
  const { data: existingEmp } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('department', department)
    .eq('full_name', fullNameStored)
    .maybeSingle();

  if (existingEmp) {
    const empActive = (existingEmp as { active?: boolean }).active;
    if (empActive === false) {
      await supabaseAdmin
        .from('employees')
        .update({ active: true, deactivated_at: null })
        .eq('id', existingEmp.id);
    }
  } else {
    const { data: lastEmp } = await supabaseAdmin
      .from('employees')
      .select('order_no')
      .eq('department', department)
      .order('order_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrderNo = (lastEmp?.order_no ?? 0) + 1;
    const { error: empErr } = await supabaseAdmin.from('employees').insert({
      full_name: fullNameStored,
      department,
      order_no: nextOrderNo,
    });
    if (empErr) {
      return NextResponse.json(
        {
          user: newUser,
          warning: `Tạo user thành công nhưng không thêm được vào danh sách nhân viên: ${empErr.message}`,
        },
        { status: 207 },
      );
    }
  }

  return NextResponse.json({ user: newUser });
}
