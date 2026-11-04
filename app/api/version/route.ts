import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/version — mã phiên bản của bản đang chạy trên máy chủ (anh Hữu 04/11/2026).
// components/TaiBanMoi so mã này với mã đóng trong trang điện thoại đang giữ; khác → tải lại trang.
// Không cần đăng nhập (đã loại khỏi middleware), chỉ trả mã commit — không có dữ liệu.
export async function GET() {
  return NextResponse.json(
    { v: process.env.NEXT_PUBLIC_BAN_DUNG || 'local' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
