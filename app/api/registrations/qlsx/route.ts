import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { hasPerPersonHours, isValidPmHours, normShift, pmPresetFor, presetOf } from '@/lib/overtime-shift';
import { duplicateShiftError, overlapError } from '@/lib/overtime-guard';

export const runtime = 'nodejs';

// QLSX không có máy → mỗi item = (employee, reason). Server lưu reason vào
// item_code, dùng equipment 'CVK-QLSX' (machine_type='OTHER') làm placeholder
// cho FK. CVK-QLSX tự tạo lần đầu nếu chưa có.

type ItemInput = {
  employee_id: string;
  reason: string;
  // Số giờ riêng của người này — chỉ nhận khi ngày thường + ca chiều (anh Hữu 04/11/2026:
  // "Tăng ca QLSX cũng áp dụng tương tự như các bộ phận khác"). Cùng luật /api/registrations.
  duration_hours?: number;
};

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

  // Ca AM/PM (anh Hữu 21/10/2026): ngày thường mặc định PM, Chủ nhật luôn PM
  const shift = normShift(day_type, (body as { shift?: unknown }).shift);
  const preset = presetOf(day_type, shift);

  // Ca chiều ngày thường: mỗi người một số giờ, bắt đầu 16:30. Ca sáng / Chủ nhật: bỏ qua số giờ gửi lên.
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

  const dupErr = await duplicateShiftError(overtime_date, 'QLSX', shift);
  if (dupErr) return NextResponse.json({ error: dupErr }, { status: 409 });
  const ovErr = await overlapError(
    overtime_date,
    items.map((it) => {
      const t = rowPreset(it);
      return { employee_id: it.employee_id, time_from: t.time_from, time_to: t.time_to };
    }),
  );
  if (ovErr) return NextResponse.json({ error: ovErr }, { status: 409 });

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
      shift,
      // Đầu phiếu = bắt đầu sớm nhất / kết thúc muộn nhất / số giờ lớn nhất của các dòng
      // (giống /api/registrations). Không chọn giờ riêng → y như cũ = giờ mặc định của ca.
      time_from: rowTimes.map((t) => t.time_from).reduce((a, b) => (b < a ? b : a)),
      time_to: rowTimes.map((t) => t.time_to).reduce((a, b) => (b > a ? b : a)),
      duration_hours: Math.max(...rowTimes.map((t) => t.duration_hours)),
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

  // Giờ riêng từng dòng: chỉ ghi khi ca chiều ngày thường có chọn giờ; còn lại để trống như cũ
  // → các nơi đọc tự lấy giờ đầu phiếu.
  const timeCols = (it: ItemInput) => {
    if (!perPerson || it.duration_hours === undefined) return {};
    const t = pmPresetFor(it.duration_hours);
    return { time_from: t.time_from, time_to: t.time_to, duration_hours: t.duration_hours };
  };
  const itemRows = items.map((it) => ({
    registration_id: reg.id,
    employee_id: it.employee_id,
    equipment_id: cvkEquipmentId,
    item_code: it.reason.trim(),
    item_name: 'Công việc QLSX',
    planned_quantity: null,
    ...timeCols(it),
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
