import { supabaseAdmin } from '@/lib/supabase';

// TTL lệnh in (user chốt 11/7): quá 2 phút chưa in xong → tự hủy cho an toàn,
// người dùng lỡ bấm in thêm cũng không bị dồn bản in cũ bất ngờ chạy ra sau.
export const PRINT_JOB_TTL_MS = 2 * 60_000;

// Đánh error mọi job quá hạn: pending quá 2' (agent tắt/kẹt hàng đợi) và
// printing quá 2' (agent chết giữa chừng — in thật chỉ ~30-60s).
// Gọi ở POST (trước dedupe), GET agent-poll (trước khi trả job) và GET /mine
// (nút In đang theo dõi) — agent sống hay chết đều có ít nhất 1 cửa dọn.
export async function expireStalePrintJobs() {
  const cutoff = new Date(Date.now() - PRINT_JOB_TTL_MS).toISOString();
  const patch = {
    status: 'error',
    finished_at: new Date().toISOString(),
    error_message: 'Quá 2 phút chưa in được — lệnh đã tự hủy, hãy gửi lại',
  };
  await supabaseAdmin
    .from('print_jobs')
    .update(patch)
    .eq('status', 'pending')
    .lt('created_at', cutoff);
  await supabaseAdmin
    .from('print_jobs')
    .update(patch)
    .eq('status', 'printing')
    .lt('started_at', cutoff);
}
