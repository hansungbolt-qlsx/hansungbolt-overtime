import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'public',
  'templates',
  'overtime-form.xlsx',
);

const FOOTER_NOTE =
  '* Lưu ý: Đề nghị viết phiếu tăng ca và nộp cho phòng Nhân sự trước 14h30 trước khi tăng ca. Trường hợp tăng ca trước và nộp đơn sau thì sẽ không được tính tiền tăng ca của ngày đó.';

const DATA_MERGES: Record<'HD' | 'RL', string[]> = {
  HD: ['B9:B13', 'C9:C13', 'D9:D13', 'E9:E13', 'F9:F13', 'G9:G13', 'B17:M18', 'B19:M20'],
  RL: ['B9:M9', 'H10:H11', 'M10:M11', 'I10:I11', 'B13:M14', 'B15:M16'],
};

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  return `${h}h${m}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Chưa đăng nhập hoặc không có quyền' },
      { status: 401 },
    );
  }

  const { id } = await params;

  const { data: reg, error: regErr } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department, overtime_date, day_type, time_from, time_to, duration_hours')
    .eq('id', id)
    .single();
  if (regErr || !reg) {
    return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 });
  }
  if (reg.department !== 'HD' && reg.department !== 'RL') {
    return NextResponse.json({ error: 'Department không hợp lệ' }, { status: 500 });
  }
  const department: 'HD' | 'RL' = reg.department;

  const { data: items, error: itemErr } = await supabaseAdmin
    .from('overtime_items')
    .select('employee_id, equipment_id, item_code, item_name, planned_quantity')
    .eq('registration_id', id);
  if (itemErr) {
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Phiếu không có dòng nào' }, { status: 400 });
  }

  const empIds = Array.from(new Set(items.map((i) => i.employee_id)));
  const eqIds = Array.from(new Set(items.map((i) => i.equipment_id)));

  const [{ data: emps }, { data: eqs }] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('id, full_name, order_no')
      .in('id', empIds),
    supabaseAdmin.from('equipments').select('id, code').in('id', eqIds),
  ]);

  const empMap = new Map((emps ?? []).map((e) => [e.id, e]));
  const eqMap = new Map((eqs ?? []).map((e) => [e.id, e]));

  // HD-15..HD-31 = nhóm M4, HD-50..HD-55 = nhóm M3
  function machineGroup(code: string): 'M4' | 'M3' | null {
    const m = code.match(/^HD-(\d+)$/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (n >= 15 && n <= 31) return 'M4';
    if (n >= 50 && n <= 55) return 'M3';
    return null;
  }

  type GroupRow = {
    code: string;
    item_code: string;
    item_name: string | null;
    qty: number;
  };
  const groups = new Map<
    string,
    {
      order_no: number;
      full_name: string;
      individual: GroupRow[];
      m4: GroupRow[];
      m3: GroupRow[];
    }
  >();
  for (const it of items) {
    const emp = empMap.get(it.employee_id);
    const eq = eqMap.get(it.equipment_id);
    if (!emp || !eq) continue;
    if (!groups.has(emp.id)) {
      groups.set(emp.id, {
        order_no: emp.order_no,
        full_name: emp.full_name,
        individual: [],
        m4: [],
        m3: [],
      });
    }
    const row: GroupRow = {
      code: eq.code,
      item_code: it.item_code,
      item_name: it.item_name,
      qty: it.planned_quantity,
    };
    const grp = machineGroup(eq.code);
    const slot = groups.get(emp.id)!;
    if (grp === 'M4') slot.m4.push(row);
    else if (grp === 'M3') slot.m3.push(row);
    else slot.individual.push(row);
  }

  // Gộp M4/M3 thành 1 dòng "HD-M{x} (NEA)" với mã hàng "M{x}", số lượng = tổng
  const sortedGroups = [...groups.values()]
    .sort((a, b) => a.order_no - b.order_no)
    .map((g) => {
      const rows: GroupRow[] = [...g.individual];
      if (g.m4.length > 0) {
        rows.push({
          code: `HD-M4 (${g.m4.length}EA)`,
          item_code: 'M4',
          item_name: 'M4',
          qty: g.m4.reduce((s, r) => s + r.qty, 0),
        });
      }
      if (g.m3.length > 0) {
        rows.push({
          code: `HD-M3 (${g.m3.length}EA)`,
          item_code: 'M3',
          item_name: 'M3',
          qty: g.m3.reduce((s, r) => s + r.qty, 0),
        });
      }
      return { order_no: g.order_no, full_name: g.full_name, rows };
    });

  const buf = await fs.readFile(TEMPLATE_PATH);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);

  const sheet = wb.getWorksheet(department);
  if (!sheet) {
    return NextResponse.json(
      { error: `Template thiếu sheet ${department}` },
      { status: 500 },
    );
  }

  for (const r of DATA_MERGES[department]) {
    try {
      sheet.unMergeCells(r);
    } catch {}
  }

  for (let r = 9; r <= 30; r++) {
    for (let c = 2; c <= 13; c++) {
      sheet.getRow(r).getCell(c).value = null;
    }
  }

  sheet.getCell('H5').value = `Bộ phận:  ${department}\r\nDepartment:`;

  const timeLabel = `${formatTime(reg.time_from)}-${formatTime(reg.time_to)}`;
  // Giờ hiển thị (3h hoặc 8h theo day_type) — bỏ qua duration_hours cũ trong DB
  const hours = reg.day_type === 'sunday' ? 8 : 3;

  let rowPtr = 9;
  let stt = 1;

  for (const group of sortedGroups) {
    const startRow = rowPtr;
    const endRow = rowPtr + group.rows.length - 1;

    for (let i = 0; i < group.rows.length; i++) {
      const item = group.rows[i];
      const row = sheet.getRow(rowPtr);
      if (i === 0) {
        row.getCell(2).value = stt;
        row.getCell(3).value = group.full_name;
        row.getCell(4).value = timeLabel;
        row.getCell(5).value = hours;
      }
      row.getCell(8).value = item.code;
      row.getCell(9).value = item.item_code;
      // Giữ là số (calculable), format dấu , là phân cách hàng nghìn
      const qtyCell = row.getCell(10);
      qtyCell.value = item.qty;
      qtyCell.numFmt = '#,##0';
      qtyCell.alignment = { ...qtyCell.alignment, horizontal: 'center', vertical: 'middle' };
      rowPtr++;
    }

    if (group.rows.length > 1) {
      sheet.mergeCells(startRow, 2, endRow, 2);
      sheet.mergeCells(startRow, 3, endRow, 3);
      sheet.mergeCells(startRow, 4, endRow, 4);
      sheet.mergeCells(startRow, 5, endRow, 5);
      sheet.mergeCells(startRow, 6, endRow, 6);
      sheet.mergeCells(startRow, 7, endRow, 7);
    }
    stt++;
  }

  const noteRow = rowPtr + 1;
  sheet.getCell(`B${noteRow}`).value = FOOTER_NOTE;
  sheet.mergeCells(`B${noteRow}:M${noteRow + 1}`);
  const noteCell = sheet.getCell(`B${noteRow}`);
  noteCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };
  noteCell.font = { italic: true, size: 10 };

  const outBuf = await wb.xlsx.writeBuffer();
  const filename = `Phieu_TangCa_${department}_${reg.overtime_date}.xlsx`;

  return new Response(outBuf as BodyInit, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
