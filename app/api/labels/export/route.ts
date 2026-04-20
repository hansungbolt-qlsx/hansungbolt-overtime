import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const BUCKET = 'material-labels';

// Layout: 2 cols (A, B) × 4 rows = 8 slots per sheet
// Matches "Copy Tem NVL.xlsx" template
const SLOTS_PER_SHEET = 8;

// Single-cell string ranges: 'A1:A1' anchors image exactly to cell A1
const SLOT_CELLS = ['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4'] as const;

function configureSheet(sheet: ExcelJS.Worksheet) {
  // 2 wide columns matching the template (76.25 char units each)
  sheet.getColumn('A').width = 76.25;
  sheet.getColumn('B').width = 76.25;

  // 4 tall rows matching the template (333 pt each)
  for (let r = 1; r <= 4; r++) {
    sheet.getRow(r).height = 333;
  }

  sheet.pageSetup = {
    paperSize: 9,          // A4
    orientation: 'portrait',
    scale: 62,             // 62% scale — matches template
    margins: {
      left: 0,
      right: 0.197,
      top: 0,
      bottom: 0,
      header: 0,
      footer: 0,
    },
  };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Chưa đăng nhập hoặc không có quyền' },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Thiếu date' }, { status: 400 });
  }

  const { data: photos, error: photoErr } = await supabaseAdmin
    .from('material_label_photos')
    .select('id, storage_path')
    .eq('label_date', date)
    .order('uploaded_at', { ascending: true });
  if (photoErr) {
    return NextResponse.json({ error: photoErr.message }, { status: 500 });
  }
  if (!photos || photos.length === 0) {
    return NextResponse.json({ error: 'Ngày này chưa có tem nào' }, { status: 400 });
  }

  const buffers: Array<{ buffer: Buffer; ext: 'jpeg' | 'png' }> = [];
  for (const p of photos) {
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(p.storage_path);
    if (dlErr || !file) continue;
    const ab = await file.arrayBuffer();
    const ext = p.storage_path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    buffers.push({ buffer: Buffer.from(ab), ext });
  }

  if (buffers.length === 0) {
    return NextResponse.json({ error: 'Không tải được ảnh' }, { status: 500 });
  }

  const wb = new ExcelJS.Workbook();

  // Split into chunks of 8 (one sheet per chunk)
  const chunks: Array<typeof buffers> = [];
  for (let i = 0; i < buffers.length; i += SLOTS_PER_SHEET) {
    chunks.push(buffers.slice(i, i + SLOTS_PER_SHEET));
  }

  for (let c = 0; c < chunks.length; c++) {
    const name = chunks.length === 1 ? 'Tem NVL' : `Tem NVL (${c + 1})`;
    const sheet = wb.addWorksheet(name);
    configureSheet(sheet);

    const chunk = chunks[c];
    for (let i = 0; i < chunk.length; i++) {
      const img = chunk[i];
      const imgId = wb.addImage({
        buffer: img.buffer as unknown as ArrayBuffer,
        extension: img.ext,
      });
      const cell = SLOT_CELLS[i];
      sheet.addImage(imgId, `${cell}:${cell}`);
    }
  }

  const outBuf = await wb.xlsx.writeBuffer();
  return new Response(outBuf as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Tem_NVL_HD_${date}.xlsx"`,
    },
  });
}
