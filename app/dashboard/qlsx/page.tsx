import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import DashboardHeader from '@/components/DashboardHeader';
import QlsxOvertimeForm from '@/components/QlsxOvertimeForm';

export default async function QlsxOvertimePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/register');

  // Load 5 NV QLSX (sau khi migration 09 đã chạy)
  const { data: emps, error } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, order_no, active')
    .eq('department', 'QLSX')
    .eq('active', true)
    .order('order_no', { ascending: true });

  const hasQlsxSetup = !error && (emps?.length ?? 0) > 0;

  return (
    <main className="min-h-screen bg-brand-pattern p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <DashboardHeader fullName={session.fullName} active="qlsx" />

        <div className="mb-5">
          <h2 className="text-lg font-bold text-brand-navy">Đăng ký tăng ca — Bộ phận QLSX</h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Form đăng ký dành riêng cho khối quản lý sản xuất. Mỗi NV ghi rõ lý do tăng ca.
          </p>
        </div>

        {!hasQlsxSetup ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4 rounded-lg space-y-2">
            <p className="font-semibold">Chưa thiết lập bộ phận QLSX trên database.</p>
            <p>
              Cần chạy migration <code className="bg-amber-100 px-1 rounded">docs/sql/09-qlsx-department.sql</code> trên Supabase SQL Editor (mở <strong>New Query</strong> tab MỚI TRỐNG).
            </p>
            <p className="text-xs text-amber-800">
              Sau khi chạy xong, refresh trang này.
            </p>
          </div>
        ) : (
          <QlsxOvertimeForm
            employees={(emps ?? []).map((e) => ({
              id: e.id,
              full_name: e.full_name,
              order_no: e.order_no,
            }))}
            defaultRequestor={session.fullName}
          />
        )}
      </div>
    </main>
  );
}
