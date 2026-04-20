import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

type ItemInput = {
  employee_id: string;
  equipment_id: string;
  item_code: string;
  item_name: string | null;
  planned_quantity: number;
};

// duration_hours = giờ hiển thị trên phiếu (3h, 8h)
// Số giờ tính sản lượng dự kiến nằm ở client (2.5h, 7.5h) — xem OvertimeForm
const DAY_PRESETS = {
  weekday: { time_from: '16:30:00', time_to: '19:30:00', duration_hours: 3 },
  sunday: { time_from: '06:00:00', time_to: '14:00:00', duration_hours: 8 },
} as const;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'leader' || !session.department) {
    return NextResponse.json({ error: 'Chưa đăng nhập hoặc không có quyền' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 });
  }

  const { overtime_date, day_type, items } = body as {
    overtime_date?: string;
    day_type?: 'weekday' | 'sunday';
    items?: ItemInput[];
  };

  if (!overtime_date || !day_type || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: 'Thiếu ngày, loại ngày hoặc danh sách dòng' },
      { status: 400 },
    );
  }
  if (day_type !== 'weekday' && day_type !== 'sunday') {
    return NextResponse.json({ error: 'day_type phải là weekday hoặc sunday' }, { status: 400 });
  }
  for (const it of items) {
    if (!it.employee_id || !it.equipment_id || !it.item_code) {
      return NextResponse.json({ error: 'Có dòng thiếu dữ liệu' }, { status: 400 });
    }
  }

  const preset = DAY_PRESETS[day_type];

  const { data: reg, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .insert({
      department: session.department,
      registered_by: session.userId,
      overtime_date,
      day_type,
      time_from: preset.time_from,
      time_to: preset.time_to,
      duration_hours: preset.duration_hours,
      status: 'pending',
    })
    .select('id')
    .single();

  if (regErr || !reg) {
    return NextResponse.json(
      { error: regErr?.message || 'Không tạo được phiếu' },
      { status: 500 },
    );
  }

  const itemRows = items.map((it) => ({
    registration_id: reg.id,
    employee_id: it.employee_id,
    equipment_id: it.equipment_id,
    item_code: it.item_code,
    item_name: it.item_name,
    planned_quantity: it.planned_quantity,
  }));

  const { error: itemErr } = await supabaseAdmin.from('overtime_items').insert(itemRows);
  if (itemErr) {
    await supabaseAdmin.from('overtime_registrations').delete().eq('id', reg.id);
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: reg.id, items_count: itemRows.length });
}
