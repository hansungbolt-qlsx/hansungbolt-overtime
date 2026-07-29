import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildEmpDateHours, type RegRow, type ItemRow } from '@/lib/overtime-hours';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/overtime-export — nguồn cho menu Overtime trên app chính (29/7/2026)
//
// Agent trên PC admin gọi (Bearer AGENT_SECRET, giống /api/print-jobs):
//   ?meta=1 → { fp, coverage_start }  — dấu vân tay ~150 B, agent so mỗi 60s
//   (đủ)    → toàn bộ người × ngày trong cửa sổ dữ liệu còn trên Supabase
//
// - Giờ tính bằng lib/overtime-hours.ts — DÙNG CHUNG với bản in admin, app
//   chính không tính lại (bẫy phồng 4,4 lần nếu cộng theo dòng).
// - coverage_start = hôm nay VN − 30 ngày, khớp cron cleanup (xóa phiếu cũ
//   hơn 30 ngày). App chính CHỈ ghi đè dữ liệu ≥ coverage_start; phần cũ hơn
//   chỉ còn ở app chính (kho lưu vĩnh viễn) — TUYỆT ĐỐI không thay-cả-bảng.
// - fp = hàm SQL overtime_fingerprint() (migration 19). Chưa chạy migration
//   → fp null, agent tự hạ nhịp kéo 30 phút/lần thay vì dò 60s.
// =============================================================================

function unauthorized(msg: string, status = 401) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/** Hôm nay VN − 30 ngày. Server Vercel là UTC → +7h rồi mới lấy ngày. */
function coverageStartVN(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

async function fingerprint(): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('overtime_fingerprint');
  if (error) return null; // migration 19 chưa chạy — agent sẽ hạ nhịp kéo
  return typeof data === 'string' ? data : null;
}

/** Kéo đủ mọi trang (Supabase mặc định trần 1000 dòng/lượt — items đã 836). */
async function pullAll<T>(table: string, select: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .order(order)
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function GET(req: Request) {
  const secret = process.env.AGENT_SECRET;
  if (!secret) return unauthorized('AGENT_SECRET chưa được cấu hình trên server', 500);
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return unauthorized('Sai AGENT_SECRET');
  }

  const coverage_start = coverageStartVN();
  const url = new URL(req.url);

  if (url.searchParams.get('meta') === '1') {
    return NextResponse.json({ ok: true, fp: await fingerprint(), coverage_start });
  }

  try {
    type FullReg = RegRow & {
      department: string; time_from: string | null; time_to: string | null;
    };
    type FullItem = ItemRow & {
      equipment_id: string | null; item_code: string | null; item_name: string | null;
      planned_quantity: number | null; actual_quantity: number | null;
      note: string | null; time_from: string | null; time_to: string | null;
    };
    const [regs, items, emps, eqs] = await Promise.all([
      pullAll<FullReg>(
        'overtime_registrations',
        'id, overtime_date, day_type, duration_hours, department, time_from, time_to',
        'overtime_date',
      ),
      pullAll<FullItem>(
        'overtime_items',
        'employee_id, registration_id, duration_hours, equipment_id, item_code,'
          + ' item_name, planned_quantity, actual_quantity, note, time_from, time_to',
        'id',
      ),
      pullAll<{
        id: string; full_name: string; department: string;
        order_no: number | null; active: boolean | null;
      }>('employees', 'id, full_name, department, order_no, active', 'order_no'),
      pullAll<{ id: string; code: string; machine_type: string | null }>(
        'equipments', 'id, code, machine_type', 'code'),
    ]);

    const { empDateMap, dateTypeMap } = buildEmpDateHours(regs, items);

    // BẢN SAO LƯU TOÀN BỘ (user chốt 29/7 tối): kèm chi tiết từng dòng phiếu —
    // máy, mã hàng, số lượng, khung giờ, ghi chú — để app chính lưu vĩnh viễn.
    // Khung giờ/ghi chú ưu tiên giá trị dòng (admin sửa tay), rơi về giá trị
    // phiếu. `hours` ở đây là giờ THÔ của dòng, CHỈ để xem chi tiết — giờ tính
    // công vẫn lấy từ `rows` (luật MAX người × ngày), không được cộng details.
    const regById = new Map(regs.map((r) => [r.id, r]));
    const eqById = new Map(eqs.map((e) => [e.id, e]));
    const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : null);
    const details = items.flatMap((it) => {
      const rg = regById.get(it.registration_id);
      if (!rg) return [];
      const eq = it.equipment_id ? eqById.get(it.equipment_id) : undefined;
      return [{
        employee_id: it.employee_id,
        date: rg.overtime_date,
        department: rg.department,
        machine: eq?.code ?? null,
        machine_type: eq?.machine_type ?? null,
        item_code: it.item_code,
        item_name: it.item_name,
        qty_planned: it.planned_quantity,
        qty_actual: it.actual_quantity,
        time_from: hhmm(it.time_from) ?? hhmm(rg.time_from),
        time_to: hhmm(it.time_to) ?? hhmm(rg.time_to),
        hours: it.duration_hours ?? rg.duration_hours,
        note: it.note,
        reg_id: it.registration_id,
      }];
    });

    const rows: Array<{ employee_id: string; date: string; hours: number }> = [];
    for (const [empId, dateMap] of empDateMap) {
      for (const [date, hours] of dateMap) rows.push({ employee_id: empId, date, hours });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.employee_id.localeCompare(b.employee_id));

    const dates = Array.from(dateTypeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day_type]) => ({ date, day_type }));

    return NextResponse.json({
      ok: true,
      fp: await fingerprint(),
      coverage_start,
      generated_at: new Date().toISOString(),
      employees: emps,
      dates,
      rows,
      details,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
