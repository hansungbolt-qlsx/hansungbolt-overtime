import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

// GET /api/plan-files — list các file kế hoạch đã upload (admin only)
// Trả về tối đa MAX_KEPT_FILES (3) bản ghi, sort theo plan_date desc.
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('plan_files')
    .select('id, plan_date, file_name, sheet_name, file_size_bytes, uploaded_at')
    .order('plan_date', { ascending: false })
    .limit(10);

  if (error) {
    // Bảng có thể chưa tồn tại (migration 10 chưa chạy) → trả mảng rỗng + warning
    return NextResponse.json({
      files: [],
      warning: `Không lấy được danh sách: ${error.message}. Có thể migration 10 chưa chạy.`,
    });
  }

  return NextResponse.json({ files: data ?? [] });
}
