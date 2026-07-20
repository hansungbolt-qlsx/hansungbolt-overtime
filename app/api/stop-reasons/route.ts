import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// Danh mục lý do (user chốt 19/7) — ETC bắt buộc ghi lý do cụ thể
const REASONS = ['NW', 'NM', 'NP', 'NR', 'MT', 'ETC'] as const;

function todayVN(): string {
  // Server Vercel = UTC → quy giờ VN (+7) rồi lấy YYYY-MM-DD
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// GET /api/stop-reasons?date=YYYY-MM-DD
// - Tổ trưởng/admin (session): xem bản ghi ngày đó + danh sách máy bộ phận mình.
// - App chính (poller, đăng nhập admin qua cookie như upload-plan): đọc để điền TV.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (session.role !== 'admin' && session.role !== 'leader') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  const url = new URL(req.url);
  const date = (url.searchParams.get('date') || todayVN()).slice(0, 10);

  const { data: reasons, error } = await supabaseAdmin
    .from('machine_stop_reasons')
    .select('stop_date, machine_code, department, reason_code, reason_text, created_by_name, updated_at')
    .eq('stop_date', date)
    .order('machine_code');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Danh sách máy cho UI — leader chỉ thấy bộ phận mình, admin thấy hết
  let eq = supabaseAdmin
    .from('equipment')
    .select('code, department')
    .order('code');
  if (session.role === 'leader' && session.department) {
    eq = eq.eq('department', session.department);
  }
  const { data: machines, error: eqErr } = await eq;
  if (eqErr) {
    return NextResponse.json({ error: eqErr.message }, { status: 500 });
  }
  return NextResponse.json({ date, reasons: reasons ?? [], machines: machines ?? [] });
}

// POST /api/stop-reasons — tổ trưởng ghi/sửa/xóa 1 máy
// body: { date, machine_code, reason_code | null, reason_text? }
// reason_code = null → xóa bản ghi (bỏ đánh dấu máy dừng).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (session.role !== 'admin' && session.role !== 'leader') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  let body: {
    date?: string;
    machine_code?: string;
    reason_code?: string | null;
    reason_text?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }
  const date = (body.date || todayVN()).slice(0, 10);
  const machine = (body.machine_code || '').trim();
  if (!machine) {
    return NextResponse.json({ error: 'Thiếu machine_code' }, { status: 400 });
  }

  // Xóa đánh dấu
  if (body.reason_code === null || body.reason_code === '') {
    const { error } = await supabaseAdmin
      .from('machine_stop_reasons')
      .delete()
      .eq('stop_date', date)
      .eq('machine_code', machine);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: true });
  }

  const code = String(body.reason_code || '').toUpperCase();
  if (!REASONS.includes(code as (typeof REASONS)[number])) {
    return NextResponse.json({ error: `Lý do không hợp lệ: ${code}` }, { status: 400 });
  }
  const text = (body.reason_text || '').trim();
  if (code === 'ETC' && !text) {
    return NextResponse.json(
      { error: 'Lý do Khác (Etc) phải ghi rõ nội dung cụ thể' },
      { status: 400 },
    );
  }

  // Máy phải tồn tại (chặn gõ bừa); leader chỉ ghi máy bộ phận mình
  const { data: eq } = await supabaseAdmin
    .from('equipment')
    .select('code, department')
    .eq('code', machine)
    .maybeSingle();
  if (!eq) {
    return NextResponse.json({ error: `Không có máy ${machine}` }, { status: 400 });
  }
  if (session.role === 'leader' && session.department && eq.department !== session.department) {
    return NextResponse.json({ error: 'Máy không thuộc bộ phận của bạn' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('machine_stop_reasons').upsert(
    {
      stop_date: date,
      machine_code: machine,
      department: eq.department,
      reason_code: code,
      reason_text: code === 'ETC' ? text : text || null,
      created_by: session.userId,
      created_by_name: session.fullName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stop_date,machine_code' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
