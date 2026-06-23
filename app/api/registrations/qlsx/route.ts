import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// QLSX không có máy → mỗi item = (employee, reason). Server lưu reason vào
// item_code, dùng equipment 'CVK-QLSX' (machine_type='OTHER') làm placeholder
// cho FK. CVK-QLSX tự tạo lần đầu nếu chưa có.

type ItemInput = {
  employee_id: string;
  reason: string;
};

const DAY_PRESETS = {
  weekday: { time_from: '16:30:00', time_to: '19:30:00', duration_hours: 3 },
  sunday: { time_from: '06:00:00', time_to: '14:00:00', duration_hours: 8 },
} as const;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ admin được đăng ký tăng ca QLSX' }, { status: 403 });
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
    return NextResponse.json({ error: 'day_type không hợp lệ' }, { status: 400 });
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.employee_id) {
      return NextResponse.json(
        { error: `Dòng ${i + 1}: chưa chọn nhân viên` },
        { status: 400 },
      );
    }
    if (!it.reason?.trim()) {
      return NextResponse.json(
        { error: `Dòng ${i + 1}: chưa nhập lý do tăng ca` },
        { status: 400 },
      );
    }
  }

  const preset = DAY_PRESETS[day_type];

  // Đảm bảo CVK-QLSX equipment tồn tại
  const cvkCode = 'CVK-QLSX';
  let cvkEquipmentId: string;
  const { data: existingCvk } = await supabaseAdmin
    .from('equipments')
    .select('id')
    .eq('code', cvkCode)
    .maybeSingle();
  if (existingCvk) {
    cvkEquipmentId = existingCvk.id;
  } else {
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('equipments')
      .insert({
        code: cvkCode,
        department: 'QLSX',
        spec: 'Công việc QLSX',
        machine_type: 'OTHER',
        rpm: 0,
      })
      .select('id')
      .single();
    if (insErr || !inserted) {
      return NextResponse.json(
        {
          error:
            insErr?.message ??
            'Không tạo được equipment CVK-QLSX. Có thể migration 09 chưa chạy.',
        },
        { status: 500 },
      );
    }
    cvkEquipmentId = inserted.id;
  }

  // Tạo phiếu
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .insert({
      department: 'QLSX',
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
      {
        error:
          regErr?.message ??
          'Không tạo được phiếu. Có thể migration 09 chưa chạy.',
      },
      { status: 500 },
    );
  }

  const itemRows = items.map((it) => ({
    registration_id: reg.id,
    employee_id: it.employee_id,
    equipment_id: cvkEquipmentId,
    item_code: it.reason.trim(),
    item_name: 'Công việc QLSX',
    planned_quantity: null,
  }));

  const { error: itemErr } = await supabaseAdmin
    .from('overtime_items')
    .insert(itemRows);
  if (itemErr) {
    await supabaseAdmin.from('overtime_registrations').delete().eq('id', reg.id);
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: reg.id, items_count: itemRows.length });
}
