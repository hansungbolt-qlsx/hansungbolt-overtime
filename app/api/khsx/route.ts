import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { extractKhsxSheet } from '@/lib/khsx-sheet';

export const runtime = 'nodejs';

const STORAGE_BUCKET = 'plan-files';

// GET /api/khsx — dữ liệu 2 tab KHSX (tổng + hôm nay) từ file ISO mới nhất
// app chính đã đẩy sang. Leader + admin xem được.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (session.role !== 'admin' && session.role !== 'leader') {
    return NextResponse.json({ error: 'Không có quyền xem KHSX' }, { status: 403 });
  }

  const { data: pf, error } = await supabaseAdmin
    .from('plan_files')
    .select('id, plan_date, file_name, storage_path, uploaded_at')
    .order('plan_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !pf) {
    return NextResponse.json(
      { error: 'Chưa có file KHSX nào được đồng bộ từ app chính' },
      { status: 404 },
    );
  }

  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(pf.storage_path);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: `Không tải được file: ${dlErr?.message ?? 'unknown'}` },
      { status: 500 },
    );
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const wb = XLSX.read(buf, { type: 'buffer' });
  const tong = extractKhsxSheet(wb.Sheets['KHSX tổng']);
  const homnay = extractKhsxSheet(wb.Sheets['KHSX hôm nay']);

  if (!tong && !homnay) {
    return NextResponse.json(
      {
        error:
          'File mới nhất chưa đúng định dạng ISO 2 sheet (KHSX tổng / KHSX hôm nay) — chờ app chính Chốt kế hoạch lần tới.',
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    fileId: pf.id,
    planDate: pf.plan_date,
    fileName: pf.file_name,
    uploadedAt: pf.uploaded_at,
    tong,
    homnay,
  });
}
