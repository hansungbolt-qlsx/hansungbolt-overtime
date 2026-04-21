import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

type PatchItem = {
  employee_id: string;
  equipment_id: string;
  item_code: string;
  item_name?: string | null;
  time_from: string; // "HH:MM" hoặc "HH:MM:SS"
  time_to: string;
};

// Giờ break cố định 30 phút → calcHours = duration_hours - 0.5 (nếu duration > 0.5)
function calcQtyHours(durationHours: number): number {
  return Math.max(0, durationHours - 0.5);
}

// Tính duration giờ từ 2 chuỗi time — không xử lý qua đêm (form bắt buộc to > from)
function diffHours(from: string, to: string): number {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  return (th * 60 + tm - fh * 60 - fm) / 60;
}

// "HH:MM" → "HH:MM:00" để khớp kiểu TIME
function toSqlTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ admin được sửa phiếu' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 });

  const { items } = body as { items?: PatchItem[] };

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'Thiếu danh sách dòng' }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'Phiếu phải còn ít nhất 1 dòng' }, { status: 400 });
  }

  // Load phiếu để check tồn tại + lấy department
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department')
    .eq('id', id)
    .maybeSingle();
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });
  if (!reg) return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 });

  // Validate items có đủ dữ liệu
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.employee_id || !it.equipment_id || !it.item_code?.trim()) {
      return NextResponse.json(
        { error: `Dòng ${i + 1}: thiếu dữ liệu (nhân viên/máy/mã hàng)` },
        { status: 400 },
      );
    }
    if (!it.time_from || !it.time_to) {
      return NextResponse.json({ error: `Dòng ${i + 1}: thiếu giờ` }, { status: 400 });
    }
    if (diffHours(it.time_from, it.time_to) <= 0) {
      return NextResponse.json(
        { error: `Dòng ${i + 1}: giờ kết thúc phải sau giờ bắt đầu` },
        { status: 400 },
      );
    }
  }

  // Lấy RPM của các equipment để tính lại planned_quantity per row
  const eqIds = Array.from(new Set(items.map((it) => it.equipment_id)));
  const { data: eqs, error: eqErr } = await supabaseAdmin
    .from('equipments')
    .select('id, rpm, machine_type')
    .in('id', eqIds);
  if (eqErr) return NextResponse.json({ error: eqErr.message }, { status: 500 });
  const eqMap = new Map((eqs ?? []).map((e) => [e.id, e]));

  // Cập nhật header: time_from = min, time_to = max, duration = longest
  // (cho dashboard summary thể hiện khoảng phiếu bao trùm)
  const headerFromMin = items
    .map((it) => toSqlTime(it.time_from))
    .reduce((min, t) => (t < min ? t : min));
  const headerToMax = items
    .map((it) => toSqlTime(it.time_to))
    .reduce((max, t) => (t > max ? t : max));
  const headerDurationMax = Math.max(
    ...items.map((it) => diffHours(it.time_from, it.time_to)),
  );

  const { error: updHeaderErr } = await supabaseAdmin
    .from('overtime_registrations')
    .update({
      time_from: headerFromMin,
      time_to: headerToMax,
      duration_hours: headerDurationMax,
    })
    .eq('id', id);
  if (updHeaderErr)
    return NextResponse.json({ error: updHeaderErr.message }, { status: 500 });

  // Strategy: xóa hết items cũ + insert items mới với time per row
  const { error: delItemsErr } = await supabaseAdmin
    .from('overtime_items')
    .delete()
    .eq('registration_id', id);
  if (delItemsErr)
    return NextResponse.json({ error: delItemsErr.message }, { status: 500 });

  const itemRows = items.map((it) => {
    const eq = eqMap.get(it.equipment_id);
    const isOther = eq?.machine_type === 'OTHER';
    const d = diffHours(it.time_from, it.time_to);
    const qtyH = calcQtyHours(d);
    return {
      registration_id: id,
      employee_id: it.employee_id,
      equipment_id: it.equipment_id,
      item_code: it.item_code.trim(),
      item_name: isOther ? 'Công việc khác' : (it.item_name ?? null),
      planned_quantity: isOther ? null : Math.round((eq?.rpm ?? 0) * 60 * qtyH),
      time_from: toSqlTime(it.time_from),
      time_to: toSqlTime(it.time_to),
      duration_hours: d,
    };
  });

  const { error: insErr } = await supabaseAdmin.from('overtime_items').insert(itemRows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, items_count: itemRows.length });
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

  // Admin xóa được mọi phiếu; leader chỉ xóa được phiếu của bộ phận mình
  const isAdmin = session.role === 'admin';
  const isOwnDeptLeader = session.role === 'leader' && session.department === reg.department;
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
