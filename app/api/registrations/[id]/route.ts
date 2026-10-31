import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { isISODate, normShift, presetOf, qtyHoursOf } from '@/lib/overtime-shift';
import { duplicateShiftError, overlapError } from '@/lib/overtime-guard';

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
  // RPM nhập tay (bộ phận CO — máy CO rpm master = 0, anh Hữu 05/10/2026); >0 thì thay RPM master
  rpm?: number;
  is_other?: boolean;
  other_description?: string;
  time_from?: string;
  time_to?: string;
};

type PatchBody = {
  // Đổi ngày tăng ca (anh Hữu 31/10/2026) — kiểm trùng ca + trùng giờ theo NGÀY MỚI
  overtime_date?: string;
  day_type?: 'weekday' | 'sunday';
  shift?: 'AM' | 'PM';
  items?: PatchItem[];
};

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
  if (body.overtime_date !== undefined && !isISODate(body.overtime_date)) {
    return NextResponse.json({ error: 'Ngày tăng ca không hợp lệ' }, { status: 400 });
  }

  // Load phiếu
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department, day_type, shift, overtime_date')
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

  // Chỉ admin sửa giờ từng dòng (anh Hữu 21/10/2026) — tổ trưởng gửi giờ lên cũng bỏ qua
  if (session.role !== 'admin') {
    for (const it of items) {
      delete it.time_from;
      delete it.time_to;
    }
  }

  const effectiveDayType: 'weekday' | 'sunday' =
    dayTypeIn ?? (reg.day_type as 'weekday' | 'sunday');
  const oldShift = normShift(reg.day_type, reg.shift);
  const effectiveShift = normShift(effectiveDayType, body.shift ?? oldShift);
  const preset = presetOf(effectiveDayType, effectiveShift);
  const caDoi = effectiveDayType !== reg.day_type || effectiveShift !== oldShift;
  const effectiveDate: string = body.overtime_date ?? reg.overtime_date;
  const ngayDoi = effectiveDate !== reg.overtime_date;

  if (caDoi || ngayDoi) {
    const dupErr = await duplicateShiftError(effectiveDate, reg.department, effectiveShift, id);
    if (dupErr) return NextResponse.json({ error: dupErr }, { status: 409 });
  }

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

  // Load existing item ids for diff
  const { data: existingItems, error: loadItemsErr } = await supabaseAdmin
    .from('overtime_items')
    .select('id, time_from, time_to')
    .eq('registration_id', id);
  if (loadItemsErr)
    return NextResponse.json({ error: loadItemsErr.message }, { status: 500 });

  const existingIds = new Set((existingItems ?? []).map((i) => i.id));
  // Tổ trưởng sửa phiếu (không đổi ca) → dòng cũ GIỮ giờ admin đã sửa, không đặt lại về mặc định
  const keptTime = new Map(
    (existingItems ?? [])
      .filter(() => session.role !== 'admin' && !caDoi)
      .filter((i) => i.time_from && i.time_to)
      .map((i) => [i.id, { from: i.time_from as string, to: i.time_to as string }]),
  );
  const submittedIds = new Set(
    items.map((it) => it.id).filter(Boolean) as string[],
  );
  const idsToDelete = [...existingIds].filter((eid) => !submittedIds.has(eid));

  const rowTime = (it: PatchItem) => {
    if (it.time_from && it.time_to) {
      return { tFrom: toSqlTime(it.time_from), tTo: toSqlTime(it.time_to), d: diffHours(it.time_from, it.time_to) };
    }
    const kept = it.id ? keptTime.get(it.id) : undefined;
    if (kept) return { tFrom: kept.from, tTo: kept.to, d: diffHours(kept.from, kept.to) };
    return { tFrom: preset.time_from, tTo: preset.time_to, d: preset.duration_hours };
  };

  // Giờ cùng một người trên phiếu khác cùng ngày không được chồng nhau
  const ovErr = await overlapError(
    effectiveDate,
    items.map((it) => {
      const t = rowTime(it);
      return { employee_id: it.employee_id, time_from: t.tFrom, time_to: t.tTo };
    }),
    id,
  );
  if (ovErr) return NextResponse.json({ error: ovErr }, { status: 409 });

  // Header time/duration = min giờ bắt đầu / max giờ kết thúc / max số giờ của các dòng
  //   (admin sửa từng dòng → theo dòng; tổ trưởng → giờ mặc định của ca hoặc giờ cũ giữ lại)
  const times = items.map(rowTime);
  const headerUpdate: Record<string, unknown> = {
    time_from: times.map((t) => t.tFrom).reduce((min, t) => (t < min ? t : min)),
    time_to: times.map((t) => t.tTo).reduce((max, t) => (t > max ? t : max)),
    duration_hours: Math.max(...times.map((t) => t.d)),
    shift: effectiveShift,
  };
  if (dayTypeIn) headerUpdate.day_type = dayTypeIn;
  if (ngayDoi) headerUpdate.overtime_date = effectiveDate;
  const { error: updHeaderErr } = await supabaseAdmin
    .from('overtime_registrations')
    .update(headerUpdate)
    .eq('id', id);
  if (updHeaderErr)
    return NextResponse.json({ error: updHeaderErr.message }, { status: 500 });

  const buildRow = (it: PatchItem) => {
    const equipmentId = resolveEquipmentId(it);
    const eq = eqMap.get(equipmentId);
    const isOther = it.is_other || eq?.machine_type === 'OTHER';

    // Per-row time (admin) → giờ cũ giữ lại (tổ trưởng sửa) → giờ mặc định của ca
    const { tFrom, tTo, d } = rowTime(it);
    const qtyH = qtyHoursOf(d, effectiveShift);

    const itemCode = it.is_other
      ? it.other_description!.trim()
      : it.item_code!.trim();

    return {
      registration_id: id,
      employee_id: it.employee_id,
      equipment_id: equipmentId,
      item_code: itemCode,
      item_name: isOther ? 'Công việc khác' : (it.item_name ?? null),
      planned_quantity: isOther
        ? null
        : Math.round((typeof it.rpm === 'number' && it.rpm > 0 ? it.rpm : (eq?.rpm ?? 0)) * 60 * qtyH),
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
