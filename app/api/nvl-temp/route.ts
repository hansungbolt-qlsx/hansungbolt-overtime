import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { BRANCHES, todayVN, type Branch } from '@/lib/nvl-slips';

export const runtime = 'nodejs';

// ============================================================
// PHIẾU XUẤT KHO TẠM — HÀNG CHƯA NHẬP KHO (user chốt 31/7)
//
// NPL về gấp, vào sản xuất trước khi app chính kịp nhập kho → nhân viên kho ghi
// tạm mã + lot gõ tay + KG gõ tay. Khi app chính nhập kho, tồn được đẩy xuống,
// màn hình đối chiếu gợi ý cuộn đúng → chốt → dòng vào PHIẾU XUẤT HÔM NAY.
//
// ⚠ Bảng nvl_temp_lines TÁCH RIÊNG khỏi nvl_day_slips nên cơ chế tự gửi 16h30
//   (quét phiếu nháp) không bao giờ chạm tới. Dòng tạm chưa có cuộn — gửi lên
//   app chính là lỗi hàng loạt.
//
//   GET    /api/nvl-temp?branch=nvl        → dòng đang chờ + dòng đã chốt 7 ngày
//   POST   /api/nvl-temp                   → thêm dòng tạm
//   PATCH  /api/nvl-temp                   → chốt (đánh dấu merged) sau khi đã
//                                            ghi thành công vào phiếu ngày
//   DELETE /api/nvl-temp?id=<uuid>         → xoá dòng chờ (chưa chốt)
// ============================================================

function canUse(role: string): boolean {
  return role === 'qlsx' || role === 'admin';
}

/** Số giờ treo tính từ lúc tạo — >24h thì màn hình bôi đỏ (user chốt 31/7). */
const STALE_HOURS = 24;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!canUse(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const url = new URL(req.url);
  const branch = url.searchParams.get('branch') as Branch;
  if (!BRANCHES.includes(branch)) {
    return NextResponse.json({ error: 'branch không hợp lệ' }, { status: 400 });
  }

  // Dòng chờ: lấy hết (không giới hạn ngày — treo bao lâu cũng phải thấy).
  // Dòng đã chốt: chỉ 7 ngày gần đây, để đối chiếu lại chứ không để làm việc.
  const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('nvl_temp_lines')
    .select('*')
    .eq('branch', branch)
    .or(`status.eq.waiting,real_date.gte.${since}`)
    .order('real_date', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const now = Date.now();
  const waiting = rows.filter((r) => r.status === 'waiting');
  return NextResponse.json({
    branch,
    waiting,
    merged: rows.filter((r) => r.status === 'merged'),
    n_waiting: waiting.length,
    // Treo quá 24h = cảnh báo (hàng đã vào máy mà sổ sách chưa ghi nhận).
    n_stale: waiting.filter(
      (r) => now - new Date(r.created_at).getTime() > STALE_HOURS * 3600_000,
    ).length,
  });
}

type TempLineIn = {
  real_date?: string;
  department?: string;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  lot_typed?: string;
  qty?: number | string;
  unit?: string;
  note?: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!canUse(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body phải là JSON' }, { status: 400 });

  const branch = body.branch as Branch;
  if (!BRANCHES.includes(branch)) {
    return NextResponse.json({ error: 'branch không hợp lệ' }, { status: 400 });
  }
  const rawLines: TempLineIn[] = Array.isArray(body.lines) ? body.lines : [];

  const rows = rawLines
    .map((l) => ({
      branch,
      real_date: String(l.real_date || todayVN()).slice(0, 10),
      department: l.department === 'Rolling' ? 'Rolling' : 'Heading',
      material_code: String(l.material_code || '').trim(),
      material_name: (l.material_name || '').slice(0, 255) || null,
      material_spec: (l.material_spec || '').slice(0, 128) || null,
      // Phụ liệu không có lot — ô này luôn rỗng.
      lot_typed: branch === 'nvl' ? ((l.lot_typed || '').trim().slice(0, 64) || null) : null,
      qty: Math.max(0, Number(l.qty) || 0),
      unit: (l.unit || (branch === 'nvl' ? 'KG' : 'EA')).slice(0, 16),
      note: (l.note || '').slice(0, 255) || null,
      status: 'waiting',
      created_by: session.userId,
      created_by_name: session.fullName || session.username,
    }))
    .filter((l) => l.material_code && l.qty > 0);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Cần ít nhất 1 dòng có mã và số lượng > 0' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from('nvl_temp_lines').insert(rows).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, n: data?.length ?? 0 });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!canUse(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const items: Array<{
    id?: string; coil_id?: number | null; coil_no?: string; lot_no?: string; slip_uid?: string;
  }> = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: 'Thiếu items' }, { status: 400 });
  }

  // Chốt TỪNG DÒNG. Điều kiện .eq('status','waiting') là chốt chặn chống bấm 2
  // lần / 2 điện thoại cùng chốt: lần thứ hai update 0 dòng và bị báo lại.
  const done: string[] = [];
  const skipped: string[] = [];
  for (const it of items) {
    if (!it.id) continue;
    const { data, error } = await supabaseAdmin
      .from('nvl_temp_lines')
      .update({
        status: 'merged',
        merged_at: new Date().toISOString(),
        merged_slip_uid: it.slip_uid || null,
        merged_coil_id: it.coil_id != null && Number(it.coil_id) > 0 ? Number(it.coil_id) : null,
        merged_coil_no: (it.coil_no || '').trim() || null,
        merged_lot_no: (it.lot_no || '').trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', it.id)
      .eq('status', 'waiting')
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data && data.length > 0) done.push(it.id);
    else skipped.push(it.id);
  }
  return NextResponse.json({ ok: true, done: done.length, skipped });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!canUse(session.role)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  // Chỉ xoá được dòng CHƯA CHỐT — dòng đã vào phiếu ngày là dấu vết, giữ lại.
  const { data, error } = await supabaseAdmin
    .from('nvl_temp_lines')
    .delete()
    .eq('id', id)
    .eq('status', 'waiting')
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Dòng đã được chốt — không xoá được' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
