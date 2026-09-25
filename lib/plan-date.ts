import { supabaseAdmin } from '@/lib/supabase';

/**
 * Ngày KHSX THỰC DÙNG cho một ngày đăng ký (anh Hữu 25/09/2026):
 * - có kế hoạch đúng ngày → chính ngày đó;
 * - chưa có (Chủ nhật, ngày nghỉ, app chính chưa Chốt) → bản CŨ SAU CÙNG
 *   tính đến ngày đó (plan_date lớn nhất ≤ date);
 * - chưa từng có bản nào → null.
 * Chỉ dùng cho form đăng ký tăng ca (options/items). Tab Kế hoạch SX đã tự
 * lấy file mới nhất từ trước (/api/khsx), không đi qua đây.
 */
export async function resolvePlanDate(
  date: string,
): Promise<{ planDate: string | null; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from('daily_plans')
    .select('plan_date')
    .lte('plan_date', date)
    .order('plan_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { planDate: null, error: error.message };
  return { planDate: data?.plan_date ?? null, error: null };
}
