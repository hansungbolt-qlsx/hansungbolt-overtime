import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { hasPerPersonHours, isValidPmHours, normShift, pmPresetFor, presetOf } from '@/lib/overtime-shift';
import { duplicateShiftError, overlapError } from '@/lib/overtime-guard';

export const runtime = 'nodejs';

type ItemInput = {
  employee_id: string;
  // Số giờ riêng của người này — chỉ nhận khi ngày thường + ca chiều (anh Hữu 04/11/2026)
  duration_hours?: number;
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

  // Ca chiều ngày thường: mỗi người một số giờ, bắt đầu 16:30 (anh Hữu 04/11/2026).
  // Ca sáng / Chủ nhật: bỏ qua số giờ gửi lên, giữ giờ cố định của ca.
  const perPerson = hasPerPersonHours(day_type, shift);
  if (perPerson) {
    const gioCuaNguoi = new Map<string, number>();
    for (const it of items) {
      if (it.duration_hours === undefined) continue;
      if (!isValidPmHours(it.duration_hours)) {
        return NextResponse.json(
          { error: 'Số giờ tăng ca không hợp lệ (từ 0,5 đến 7 giờ, bước 0,5 giờ)' },
          { status: 400 },
        );
      }
      const truoc = gioCuaNguoi.get(it.employee_id);
      if (truoc !== undefined && truoc !== it.duration_hours) {
        return NextResponse.json(
          { error: 'Một nhân viên có 2 số giờ khác nhau trong cùng phiếu' },
          { status: 400 },
        );
      }
      gioCuaNguoi.set(it.employee_id, it.duration_hours);
    }
  }
  const rowPreset = (it: ItemInput) =>
    perPerson && it.duration_hours !== undefined ? pmPresetFor(it.duration_hours) : preset;
  const rowTimes = items.map(rowPreset);

  const dupErr = await duplicateShiftError(overtime_date, session.department, shift);
  if (dupErr) return NextResponse.json({ error: dupErr }, { status: 409 });
  const ovErr = await overlapError(
    overtime_date,
    items.map((it) => {
      const t = rowPreset(it);
      return { employee_id: it.employee_id, time_from: t.time_from, time_to: t.time_to };
    }),
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
      // Đầu phiếu = giờ bắt đầu sớm nhất / kết thúc muộn nhất / số giờ lớn nhất của các dòng
      // (giống PATCH). Phiếu không chọn giờ riêng → y như cũ = giờ mặc định của ca.
      time_from: rowTimes.map((t) => t.time_from).reduce((a, b) => (b < a ? b : a)),
      time_to: rowTimes.map((t) => t.time_to).reduce((a, b) => (b > a ? b : a)),
      duration_hours: Math.max(...rowTimes.map((t) => t.duration_hours)),
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

  // Giờ riêng từng dòng: chỉ ghi khi phiếu cho chọn giờ riêng (ca chiều ngày thường).
  // Ca sáng / Chủ nhật để trống như cũ → các nơi đọc tự lấy giờ đầu phiếu.
  const timeCols = (it: ItemInput) => {
    if (!perPerson || it.duration_hours === undefined) return {};
    const t = pmPresetFor(it.duration_hours);
    return { time_from: t.time_from, time_to: t.time_to, duration_hours: t.duration_hours };
  };

  const itemRows = items.map((it) => {
    if (it.is_other) {
      return {
        registration_id: reg.id,
        employee_id: it.employee_id,
        equipment_id: cvkEquipmentId!,
        item_code: it.other_description!.trim(),
        item_name: 'Công việc khác',
        planned_quantity: null,
        ...timeCols(it),
      };
    }
    return {
      registration_id: reg.id,
      employee_id: it.employee_id,
      equipment_id: it.equipment_id!,
      item_code: it.item_code!,
      item_name: it.item_name ?? null,
      planned_quantity: it.planned_quantity ?? null,
      ...timeCols(it),
    };
  });

  const { error: itemErr } = await supabaseAdmin.from('overtime_items').insert(itemRows);
  if (itemErr) {
    await supabaseAdmin.from('overtime_registrations').delete().eq('id', reg.id);
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: reg.id, items_count: itemRows.length });
}
