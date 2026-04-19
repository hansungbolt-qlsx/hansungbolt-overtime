import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const BUCKET = 'material-labels';

const SLOT_RANGES = [
  'B1:C5',
  'E1:F5',
  'B7:C11',
  'E7:F11',
  'B13:C17',
  'E13:F17',
  'B19:C23',
  'E19:F23',
];

function configureSheet(sheet: ExcelJS.Worksheet) {
  sheet.getColumn('A').width = 2;
  sheet.getColumn('B').width = 22;
  sheet.getColumn('C').width = 22;
  sheet.getColumn('D').width = 3;
  sheet.getColumn('E').width = 22;
  sheet.getColumn('F').width = 22;
  sheet.getColumn('G').width = 2;
  for (let r = 1; r <= 24; r++) {
    sheet.getRow(r).height = 22;
  }
  for (const range of SLOT_RANGES) {
    sheet.mergeCells(range);
  }
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2,
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
    return NextResponse.json(
      { error: 'Ngày này chưa có tem nào' },
      { status: 400 },
    );
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
  const chunks: Array<typeof buffers> = [];
  for (let i = 0; i < buffers.length; i += 8) {
    chunks.push(buffers.slice(i, i + 8));
  }

  for (let c = 0; c < chunks.length; c++) {
    const name = chunks.length === 1 ? 'Label' : `Label (${c + 1})`;
    const sheet = wb.addWorksheet(name);
    configureSheet(sheet);
    const chunk = chunks[c];
    for (let i = 0; i < chunk.length; i++) {
      const img = chunk[i];
      const imgId = wb.addImage({
        buffer: img.buffer as unknown as ArrayBuffer,
        extension: img.ext,
      });
      sheet.addImage(imgId, SLOT_RANGES[i]);
    }
  }

  const outBuf = await wb.xlsx.writeBuffer();
  return new Response(outBuf as BodyInit, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Tem_NVL_HD_${date}.xlsx"`,
    },
  });
}
