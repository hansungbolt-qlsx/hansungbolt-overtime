import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import LogoutButton from '@/components/LogoutButton';
import MaterialLabelsAdminCard from '@/components/MaterialLabelsAdminCard';
import OvertimeSummaryCard from '@/components/OvertimeSummaryCard';

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(t: string) {
  return t.slice(0, 5).replace(':', 'h');
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

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
        <header className="flex justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Hansungbolt"
              width={890}
              height={405}
              priority
              unoptimized
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-brand-navy">
                Dashboard Admin
              </h1>
              <p className="text-xs md:text-sm text-brand-navy-soft">
                Xin chào, {session.fullName}
              </p>
            </div>
          </div>
          <LogoutButton />
        </header>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-5">
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
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-5">
            <h2 className="text-lg font-semibold text-brand-navy mb-2">
              Lọc phiếu theo ngày
            </h2>
            <form method="get" className="flex gap-2">
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-brand-navy hover:bg-brand-navy-soft text-white text-sm font-semibold rounded-md transition"
              >
                Xem
              </button>
            </form>
            <p className="text-xs text-brand-navy-soft mt-2">
              Đang xem phiếu ngày <strong>{selectedDate}</strong>
            </p>
          </section>
        </div>

        <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
          <div className="p-5 border-b border-brand-surface-alt">
            <h2 className="text-lg font-semibold text-brand-navy">
              Phiếu tăng ca ngày {selectedDate}
            </h2>
            <p className="text-sm text-brand-navy-soft mt-0.5">
              {regs.length === 0 ? 'Chưa có phiếu nào.' : `Tổng: ${regs.length} phiếu`}
            </p>
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
                        {userMap.get(r.registered_by) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-brand-navy-soft">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <Link
                            href={`/dashboard/registrations/${r.id}/view?autoprint=1`}
                            className="bg-brand-teal hover:bg-brand-teal-dark text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm shadow-brand-teal/30 transition"
                          >
                            In
                          </Link>
                          <Link
                            href={`/dashboard/registrations/${r.id}/view`}
                            className="bg-brand-navy hover:bg-brand-navy-soft text-white text-xs font-semibold py-1.5 px-3 rounded-md transition"
                          >
                            Xem
                          </Link>
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
          <MaterialLabelsAdminCard date={selectedDate} />
        </div>

        <div className="mt-6">
          <OvertimeSummaryCard />
        </div>
      </div>
    </main>
  );
}
