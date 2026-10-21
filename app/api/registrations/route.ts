import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { normShift, presetOf } from '@/lib/overtime-shift';
import { duplicateShiftError, overlapError } from '@/lib/overtime-guard';

export const runtime = 'nodejs';

type ItemInput = {
  employee_id: string;
  equipment_id?: string;
  item_code?: string;
  item_name?: string | null;
  planned_quantity?: number;
  is_other?: boolean;
  other_description?: string;
};

// duration_hours = giờ hiển thị trên phiếu (PM 3h · AM 1,5h · CN 8h) — lib/overtime-shift.ts
// Số giờ tính sản lượng dự kiến nằm ở client (PM 2.5h, AM 1.5h, CN 7.5h) — xem OvertimeForm

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
    shift?: 'AM' | 'PM';
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
    if (!it.employee_id) {
      return NextResponse.json({ error: 'Có dòng thiếu nhân viên' }, { status: 400 });
    }
    if (it.is_other) {
      if (!it.other_description?.trim()) {
        return NextResponse.json(
          { error: 'Có dòng Công việc khác chưa nhập nội dung' },
          { status: 400 },
        );
      }
    } else if (!it.equipment_id || !it.item_code) {
      return NextResponse.json({ error: 'Có dòng thiếu dữ liệu' }, { status: 400 });
    }
  }

  // Ca: ngày thường mặc định PM (anh Hữu 21/10/2026), Chủ nhật luôn PM
  const shift = normShift(day_type, (body as { shift?: unknown }).shift);
  const preset = presetOf(day_type, shift);

  const dupErr = await duplicateShiftError(overtime_date, session.department, shift);
  if (dupErr) return NextResponse.json({ error: dupErr }, { status: 409 });
  const ovErr = await overlapError(
    overtime_date,
    items.map((it) => ({ employee_id: it.employee_id, time_from: preset.time_from, time_to: preset.time_to })),
  );
  if (ovErr) return NextResponse.json({ error: ovErr }, { status: 409 });

  // Nếu có dòng "Công việc khác" → đảm bảo equipment row CVK-{dept} tồn tại để dùng làm FK
  let cvkEquipmentId: string | null = null;
  if (items.some((it) => it.is_other)) {
    const cvkCode = `CVK-${session.department}`;
    const { data: existing } = await supabaseAdmin
      .from('equipments')
      .select('id')
      .eq('code', cvkCode)
      .maybeSingle();
    if (existing) {
      cvkEquipmentId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from('equipments')
        .insert({
          code: cvkCode,
          department: session.department,
          spec: 'Công việc khác',
          machine_type: 'OTHER',
          rpm: 0,
        })
        .select('id')
        .single();
      if (insErr || !inserted) {
        return NextResponse.json(
          { error: insErr?.message || 'Không tạo được equipment Công việc khác' },
          { status: 500 },
        );
      }
      cvkEquipmentId = inserted.id;
    }
  }

  const { data: reg, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .insert({
      department: session.department,
      registered_by: session.userId,
      overtime_date,
      day_type,
      shift,
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

  const itemRows = items.map((it) => {
    if (it.is_other) {
      return {
        registration_id: reg.id,
        employee_id: it.employee_id,
        equipment_id: cvkEquipmentId!,
        item_code: it.other_description!.trim(),
        item_name: 'Công việc khác',
        planned_quantity: null,
      };
    }
    return {
      registration_id: reg.id,
      employee_id: it.employee_id,
      equipment_id: it.equipment_id!,
      item_code: it.item_code!,
      item_name: it.item_name ?? null,
      planned_quantity: it.planned_quantity ?? null,
    };
  });

  const { error: itemErr } = await supabaseAdmin.from('overtime_items').insert(itemRows);
  if (itemErr) {
    await supabaseAdmin.from('overtime_registrations').delete().eq('id', reg.id);
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: reg.id, items_count: itemRows.length });
}
