import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// Danh mục lý do (user chốt 19-20/7) — ETC bắt buộc ghi lý do cụ thể
const REASONS = ['NW', 'NM', 'NP', 'NR', 'MT', 'ST', 'ETC'] as const;

function todayVN(): string {
  // Server Vercel = UTC → quy giờ VN (+7) rồi lấy YYYY-MM-DD
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function yesterdayVN(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000 - 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

// GET /api/stop-reasons?date=YYYY-MM-DD
// - Tổ trưởng/admin (session): xem bản ghi ngày đó + danh sách máy bộ phận mình.
// - App chính (poller, đăng nhập admin qua cookie như upload-plan): đọc để điền TV.
// Chỉ trả bản ghi CHƯA bị bỏ (dismissed=false); máy ảo 'Công việc khác'
// (machine_type=OTHER, vd CVK-HD) không phải máy thật → loại khỏi danh sách.
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
    .eq('dismissed', false)
    .order('machine_code');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Danh sách máy cho UI — leader chỉ thấy bộ phận mình, admin thấy hết
  let eq = supabaseAdmin
    .from('equipments')
    .select('code, department')
    .neq('machine_type', 'OTHER')
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

// POST /api/stop-reasons — tổ trưởng ghi/sửa/bỏ 1 máy
// body: { date, machine_code, reason_code | null, reason_text? }
// reason_code = null → BỎ đánh dấu (soft: dismissed=true — để prefill KHSX không
// tái sinh lại máy tổ trưởng đã xác nhận là có chạy).
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

  // Tổ trưởng CHỈ ghi/sửa hôm nay + hôm qua (user chốt 20/7) — ngày cũ là lịch
  // sử chỉ xem (bên TV thường đã chốt, bản người tổng hợp là chuẩn cao hơn).
  // Admin không bị chặn (van ngoại lệ).
  if (session.role === 'leader') {
    if (date !== todayVN() && date !== yesterdayVN()) {
      return NextResponse.json(
        { error: 'Chỉ được ghi/sửa máy dừng của HÔM NAY hoặc HÔM QUA' },
        { status: 403 },
      );
    }
  }

  // Bỏ đánh dấu (soft delete)
  if (body.reason_code === null || body.reason_code === '') {
    const { error } = await supabaseAdmin
      .from('machine_stop_reasons')
      .update({ dismissed: true, updated_at: new Date().toISOString() })
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
    .from('equipments')
    .select('code, department, machine_type')
    .eq('code', machine)
    .maybeSingle();
  if (!eq || eq.machine_type === 'OTHER') {
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
      dismissed: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stop_date,machine_code' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PUT /api/stop-reasons — PREFILL từ KHSX app chính (user 20/7, chỉ admin/poller):
// máy ngưng có nguyên nhân rõ trên KHSX (Hết NVL/Hết kế hoạch/Hư máy...) được điền
// sẵn để tổ trưởng không phải chọn lại. CHỈ chèn máy CHƯA có bản ghi ngày đó
// (kể cả bản ghi đã dismissed — tổ trưởng bỏ rồi thì không tái sinh);
// KHÔNG BAO GIỜ đè bản tổ trưởng ghi tay.
// body: { date, items: [{ machine_code, reason_code, reason_text? }] }
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ hệ thống (admin) được prefill' }, { status: 403 });
  }
  let body: {
    date?: string;
    items?: Array<{ machine_code?: string; reason_code?: string; reason_text?: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }
  const date = (body.date || todayVN()).slice(0, 10);
  const items = body.items ?? [];

  const { data: existing, error: exErr } = await supabaseAdmin
    .from('machine_stop_reasons')
    .select('machine_code')
    .eq('stop_date', date);
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  const taken = new Set((existing ?? []).map((r) => r.machine_code));

  const { data: eqs } = await supabaseAdmin
    .from('equipments')
    .select('code, department')
    .neq('machine_type', 'OTHER');
  const eqMap = new Map((eqs ?? []).map((e) => [e.code, e.department]));

  const rows = [];
  for (const it of items) {
    const machine = (it.machine_code || '').trim();
    const code = String(it.reason_code || '').toUpperCase();
    if (!machine || taken.has(machine) || !eqMap.has(machine)) continue;
    if (!REASONS.includes(code as (typeof REASONS)[number])) continue;
    const text = (it.reason_text || '').trim();
    if (code === 'ETC' && !text) continue;
    rows.push({
      stop_date: date,
      machine_code: machine,
      department: eqMap.get(machine),
      reason_code: code,
      reason_text: text || null,
      created_by: null,
      created_by_name: 'KHSX tự động',
      dismissed: false,
    });
  }
  if (rows.length) {
    const { error } = await supabaseAdmin.from('machine_stop_reasons').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, inserted: rows.length, skipped: items.length - rows.length });
}
