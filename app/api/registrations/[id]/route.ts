import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// PATCH body item — 2 chế độ:
//   A. Admin per-row time edit: có equipment_id + item_code + time_from + time_to
//   B. Leader simple edit: có equipment_id + item_code (không cần time, dùng day_type default)
//      Hoặc is_other + other_description (không có equipment_id, server tự tạo/lookup CVK-{dept})
type PatchItem = {
  id?: string | null;
  employee_id: string;
  equipment_id?: string;
  item_code?: string;
  item_name?: string | null;
  is_other?: boolean;
  other_description?: string;
  time_from?: string;
  time_to?: string;
};

type PatchBody = {
  day_type?: 'weekday' | 'sunday';
  items?: PatchItem[];
};

const DAY_PRESETS = {
  weekday: { time_from: '16:30:00', time_to: '19:30:00', duration_hours: 3 },
  sunday: { time_from: '06:00:00', time_to: '14:00:00', duration_hours: 8 },
} as const;

function calcQtyHours(durationHours: number): number {
  return Math.max(0, durationHours - 0.5);
}

function diffHours(from: string, to: string): number {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  return (th * 60 + tm - fh * 60 - fm) / 60;
}

function toSqlTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (session.role !== 'admin' && session.role !== 'leader') {
    return NextResponse.json({ error: 'Không có quyền sửa phiếu' }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 });

  const items = body.items;
  const dayTypeIn = body.day_type;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'Thiếu danh sách dòng' }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'Phiếu phải còn ít nhất 1 dòng' }, { status: 400 });
  }
  if (dayTypeIn && dayTypeIn !== 'weekday' && dayTypeIn !== 'sunday') {
    return NextResponse.json({ error: 'day_type không hợp lệ' }, { status: 400 });
  }

  // Load phiếu
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department, day_type')
    .eq('id', id)
    .maybeSingle();
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });
  if (!reg) return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 });

  if (session.role === 'leader' && session.department !== reg.department) {
    return NextResponse.json(
      { error: 'Chỉ sửa được phiếu của bộ phận mình' },
      { status: 403 },
    );
  }

  const effectiveDayType: 'weekday' | 'sunday' =
    dayTypeIn ?? (reg.day_type as 'weekday' | 'sunday');
  const preset = DAY_PRESETS[effectiveDayType];

  // Validate từng item
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.employee_id) {
      return NextResponse.json(
        { error: `Dòng ${i + 1}: thiếu nhân viên` },
        { status: 400 },
      );
    }
    if (it.is_other) {
      if (!it.other_description?.trim()) {
        return NextResponse.json(
          { error: `Dòng ${i + 1}: chưa nhập nội dung Công việc khác` },
          { status: 400 },
        );
      }
    } else {
      if (!it.equipment_id || !it.item_code?.trim()) {
        return NextResponse.json(
          { error: `Dòng ${i + 1}: thiếu máy hoặc mã hàng` },
          { status: 400 },
        );
      }
    }
    // Nếu có per-row time thì validate
    if (it.time_from || it.time_to) {
      if (!it.time_from || !it.time_to) {
        return NextResponse.json(
          { error: `Dòng ${i + 1}: thiếu giờ` },
          { status: 400 },
        );
      }
      if (diffHours(it.time_from, it.time_to) <= 0) {
        return NextResponse.json(
          { error: `Dòng ${i + 1}: giờ kết thúc phải sau giờ bắt đầu` },
          { status: 400 },
        );
      }
    }
  }

  // Nếu có item is_other → đảm bảo CVK-{dept} equipment tồn tại
  let cvkEquipmentId: string | null = null;
  if (items.some((it) => it.is_other)) {
    const cvkCode = `CVK-${reg.department}`;
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
          department: reg.department,
          spec: 'Công việc khác',
          machine_type: 'OTHER',
          rpm: 0,
        })
        .select('id')
        .single();
      if (insErr || !inserted) {
        return NextResponse.json(
          { error: insErr?.message ?? 'Không tạo được equipment CVK' },
          { status: 500 },
        );
      }
      cvkEquipmentId = inserted.id;
    }
  }

  // Resolve equipment_id cuối cùng cho mỗi item
  const resolveEquipmentId = (it: PatchItem): string => {
    if (it.is_other) return cvkEquipmentId!;
    return it.equipment_id!;
  };

  // RPM lookup
  const eqIds = Array.from(
    new Set(items.map(resolveEquipmentId).filter(Boolean)),
  );
  const { data: eqs, error: eqErr } = await supabaseAdmin
    .from('equipments')
    .select('id, rpm, machine_type')
    .in('id', eqIds);
  if (eqErr) return NextResponse.json({ error: eqErr.message }, { status: 500 });
  const eqMap = new Map((eqs ?? []).map((e) => [e.id, e]));

  // Header time/duration:
  //   - Nếu tất cả items có per-row time (admin) → min/max derive
  //   - Nếu không (leader simple) → dùng day_type preset
  const allHavePerRowTime = items.every((it) => it.time_from && it.time_to);
  let headerFrom: string;
  let headerTo: string;
  let headerDuration: number;
  if (allHavePerRowTime) {
    headerFrom = items
      .map((it) => toSqlTime(it.time_from!))
      .reduce((min, t) => (t < min ? t : min));
    headerTo = items
      .map((it) => toSqlTime(it.time_to!))
      .reduce((max, t) => (t > max ? t : max));
    headerDuration = Math.max(
      ...items.map((it) => diffHours(it.time_from!, it.time_to!)),
    );
  } else {
    headerFrom = preset.time_from;
    headerTo = preset.time_to;
    headerDuration = preset.duration_hours;
  }

  // Update header
  const headerUpdate: Record<string, unknown> = {
    time_from: headerFrom,
    time_to: headerTo,
    duration_hours: headerDuration,
  };
  if (dayTypeIn) headerUpdate.day_type = dayTypeIn;
  const { error: updHeaderErr } = await supabaseAdmin
    .from('overtime_registrations')
    .update(headerUpdate)
    .eq('id', id);
  if (updHeaderErr)
    return NextResponse.json({ error: updHeaderErr.message }, { status: 500 });

  // Load existing item ids for diff
  const { data: existingItems, error: loadItemsErr } = await supabaseAdmin
    .from('overtime_items')
    .select('id')
    .eq('registration_id', id);
  if (loadItemsErr)
    return NextResponse.json({ error: loadItemsErr.message }, { status: 500 });

  const existingIds = new Set((existingItems ?? []).map((i) => i.id));
  const submittedIds = new Set(
    items.map((it) => it.id).filter(Boolean) as string[],
  );
  const idsToDelete = [...existingIds].filter((eid) => !submittedIds.has(eid));

  const buildRow = (it: PatchItem) => {
    const equipmentId = resolveEquipmentId(it);
    const eq = eqMap.get(equipmentId);
    const isOther = it.is_other || eq?.machine_type === 'OTHER';

    // Per-row time hoặc preset
    const tFrom = it.time_from ? toSqlTime(it.time_from) : preset.time_from;
    const tTo = it.time_to ? toSqlTime(it.time_to) : preset.time_to;
    const d = it.time_from && it.time_to
      ? diffHours(it.time_from, it.time_to)
      : preset.duration_hours;
    const qtyH = calcQtyHours(d);

    const itemCode = it.is_other
      ? it.other_description!.trim()
      : it.item_code!.trim();

    return {
      registration_id: id,
      employee_id: it.employee_id,
      equipment_id: equipmentId,
      item_code: itemCode,
      item_name: isOther ? 'Công việc khác' : (it.item_name ?? null),
      planned_quantity: isOther ? null : Math.round((eq?.rpm ?? 0) * 60 * qtyH),
      time_from: tFrom,
      time_to: tTo,
      duration_hours: d,
    };
  };

  // UPDATE
  for (const it of items) {
    if (!it.id || !existingIds.has(it.id)) continue;
    const row = buildRow(it);
    const { error: updErr } = await supabaseAdmin
      .from('overtime_items')
      .update(row)
      .eq('id', it.id);
    if (updErr)
      return NextResponse.json(
        { error: `Update dòng lỗi: ${updErr.message}` },
        { status: 500 },
      );
  }

  // INSERT
  const newRows = items.filter((it) => !it.id).map(buildRow);
  if (newRows.length > 0) {
    const { error: insErr } = await supabaseAdmin
      .from('overtime_items')
      .insert(newRows);
    if (insErr)
      return NextResponse.json(
        { error: `Insert dòng lỗi: ${insErr.message}` },
        { status: 500 },
      );
  }

  // DELETE — scope theo id cụ thể, không xóa theo registration_id
  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabaseAdmin
      .from('overtime_items')
      .delete()
      .in('id', idsToDelete);
    if (delErr)
      return NextResponse.json(
        { error: `Xóa dòng lỗi: ${delErr.message}` },
        { status: 500 },
      );
  }

  return NextResponse.json({ ok: true, items_count: items.length });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { id } = await params;

  const { data: reg, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, registered_by, department')
    .eq('id', id)
    .maybeSingle();
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });
  if (!reg) return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 });

  const isAdmin = session.role === 'admin';
  const isOwnDeptLeader =
    session.role === 'leader' && session.department === reg.department;
  if (!isAdmin && !isOwnDeptLeader) {
    return NextResponse.json({ error: 'Không có quyền xóa phiếu này' }, { status: 403 });
  }

  const { error: delErr } = await supabaseAdmin
    .from('overtime_registrations')
    .delete()
    .eq('id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
