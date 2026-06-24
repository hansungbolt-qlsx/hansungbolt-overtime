import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

const STORAGE_BUCKET = 'plan-files';

// GET /api/plan-files/[id]/download — trả file Excel gốc qua signed URL redirect.
// Admin only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { id } = await params;

  const { data: file, error } = await supabaseAdmin
    .from('plan_files')
    .select('storage_path, file_name')
    .eq('id', id)
    .maybeSingle();

  if (error || !file) {
    return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 });
  }

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.storage_path, 60, {
      download: file.file_name,
    });

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? 'Không tạo được link tải' },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
