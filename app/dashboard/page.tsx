import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import DashboardHeader from '@/components/DashboardHeader';
import MaterialLabelsAdminCard from '@/components/MaterialLabelsAdminCard';
import OvertimeSummaryCard from '@/components/OvertimeSummaryCard';
// isAdmin=true chỉ cho dashboard admin — có Xem/In-Xuất trực tiếp browser.
import DeleteRegistrationButton from '@/components/DeleteRegistrationButton';
import PrintJobButton from '@/components/PrintJobButton';
import TodayOvertimeCard from '@/components/TodayOvertimeCard';
import PlanFilesList from '@/components/PlanFilesList';
import { toTitleCase } from '@/lib/format';

// Server Vercel chạy giờ UTC (lệch −7h so VN): trước 7h sáng VN dashboard sẽ nhầm
// "hôm nay" thành hôm trước + mọi giờ hiển thị lệch 7 tiếng → cộng 7h rồi đọc
// bằng getUTC* để LUÔN ra giờ Việt Nam (pattern như api/labels/cleanup).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function todayISO() {
  const d = new Date(Date.now() + VN_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(t: string) {
  return t.slice(0, 5).replace(':', 'h');
}

function formatDateTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/register');

  const today = todayISO();
  const sp = await searchParams;
  const selectedDate = sp.date ?? today;

  const [planCountRes, latestPlanRes, regsRes] = await Promise.all([
    supabaseAdmin
      .from('daily_plans')
      .select('*', { count: 'exact', head: true })
      .eq('plan_date', selectedDate),
    supabaseAdmin
      .from('daily_plans')
      .select('plan_date, uploaded_at')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('overtime_registrations')
      .select(
        'id, department, day_type, time_from, time_to, duration_hours, status, created_at, registered_by',
      )
      .eq('overtime_date', selectedDate)
      .order('created_at', { ascending: false }),
  ]);

  const regs = regsRes.data ?? [];

  const itemCountMap = new Map<string, number>();
  const userMap = new Map<string, string>();
  if (regs.length > 0) {
    const regIds = regs.map((r) => r.id);
    const userIds = Array.from(new Set(regs.map((r) => r.registered_by)));

    const [{ data: items }, { data: users }] = await Promise.all([
      supabaseAdmin
        .from('overtime_items')
        .select('registration_id')
        .in('registration_id', regIds),
      supabaseAdmin.from('users').select('id, full_name').in('id', userIds),
    ]);

    for (const it of items ?? []) {
      itemCountMap.set(
        it.registration_id,
        (itemCountMap.get(it.registration_id) ?? 0) + 1,
      );
    }
    for (const u of users ?? []) {
      userMap.set(u.id, u.full_name);
    }
  }

  return (
    <main className="min-h-screen bg-brand-pattern p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <DashboardHeader fullName={session.fullName} active="overview" />

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <section className="md:col-span-2 bg-white rounded-xl shadow-sm border border-brand-surface-alt p-5">
            <h2 className="text-lg font-semibold text-brand-navy mb-2">
              Kế hoạch sản xuất
            </h2>
            <p className="text-sm text-brand-navy-soft mb-1">
              Ngày {selectedDate}: <strong className="text-brand-navy">{planCountRes.count ?? 0}</strong> dòng kế hoạch
            </p>
            {latestPlanRes.data && (
              <p className="text-xs text-brand-navy-soft mb-3">
                Upload gần nhất: ngày {latestPlanRes.data.plan_date}
              </p>
            )}
            <Link
              href="/dashboard/upload"
              className="inline-block bg-brand-teal hover:bg-brand-teal-dark text-white text-sm font-semibold py-2 px-4 rounded-md shadow-md shadow-brand-teal/30 transition"
            >
              Upload kế hoạch mới
            </Link>

            <div className="mt-5 pt-4 border-t border-brand-surface-alt">
              <PlanFilesList />
            </div>
          </section>

          <section className="md:col-span-1 bg-white rounded-xl shadow-sm border border-brand-surface-alt p-5">
            <h2 className="text-lg font-semibold text-brand-navy mb-2">
              Lọc phiếu theo ngày
            </h2>
            <form method="get" className="flex flex-col gap-2">
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 bg-brand-navy hover:bg-brand-navy-soft text-white text-sm font-semibold rounded-md transition"
              >
                Xem
              </button>
            </form>
            <p className="text-xs text-brand-navy-soft mt-2">
              Đang xem phiếu ngày <strong>{selectedDate}</strong>
            </p>
          </section>
        </div>

        <div className="mb-6">
          <TodayOvertimeCard initialDate={selectedDate} hideDatePicker />
        </div>

        <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
          <div className="p-5 border-b border-brand-surface-alt flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-brand-navy">
                Phiếu tăng ca ngày {selectedDate}
              </h2>
              <p className="text-sm text-brand-navy-soft mt-0.5">
                {regs.length === 0 ? 'Chưa có phiếu nào.' : `Tổng: ${regs.length} phiếu`}
              </p>
            </div>
            {/* In GỘP mọi phiếu của ngày (HD trước, RL sau) trong 1 lệnh — user 15/7 */}
            {regs.length > 0 && (
              <PrintJobButton
                type="overtime_sheets"
                refId={selectedDate}
                label={`🖨 In ${regs.length} phiếu (${Array.from(new Set(regs.map((r) => r.department))).sort().join(' + ')})`}
              />
            )}
          </div>

          {regs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-surface-alt text-brand-navy">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Bộ phận</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Loại ngày</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Giờ</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Số dòng</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Người tạo</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Gửi lúc</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-surface-alt">
                  {regs.map((r) => (
                    <tr key={r.id} className="hover:bg-brand-surface/50">
                      <td className="px-4 py-3 font-semibold text-brand-navy">
                        {r.department}
                      </td>
                      <td className="px-4 py-3 text-brand-navy">
                        {r.day_type === 'weekday' ? 'Ngày thường' : 'Chủ nhật'}
                      </td>
                      <td className="px-4 py-3 text-brand-navy-soft">
                        {formatTime(r.time_from)}–{formatTime(r.time_to)} ({r.duration_hours}h)
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-brand-navy">
                        {itemCountMap.get(r.id) ?? 0}
                      </td>
                      <td className="px-4 py-3 text-brand-navy-soft">
                        {toTitleCase(userMap.get(r.registered_by)) || '—'}
                      </td>
                      <td className="px-4 py-3 text-brand-navy-soft">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <Link
                            href={`/dashboard/registrations/${r.id}/edit`}
                            className="bg-brand-teal hover:bg-brand-teal-dark text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm shadow-brand-teal/30 transition"
                          >
                            Sửa
                          </Link>
                          <Link
                            href={`/dashboard/registrations/${r.id}/view`}
                            className="bg-brand-navy hover:bg-brand-navy-soft text-white text-xs font-semibold py-1.5 px-3 rounded-md transition"
                          >
                            Xem
                          </Link>
                          <DeleteRegistrationButton id={r.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-6">
          <MaterialLabelsAdminCard />
        </div>

        <div className="mt-6">
          <OvertimeSummaryCard isAdmin />
        </div>
      </div>
    </main>
  );
}
