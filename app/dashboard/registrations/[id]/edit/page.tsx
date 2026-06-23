import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import EditRegistrationForm from '@/components/EditRegistrationForm';

export default async function EditRegistrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  // Admin xem mọi phiếu; leader chỉ xem phiếu bộ phận mình; worker không cho.
  if (session.role === 'worker') redirect('/register');

  const { id } = await params;

  const { data: reg } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department, overtime_date, day_type, time_from, time_to, duration_hours')
    .eq('id', id)
    .maybeSingle();

  if (!reg) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Không tìm thấy phiếu.</p>
      </main>
    );
  }

  const isAdmin = session.role === 'admin';
  const isOwnDeptLeader =
    session.role === 'leader' && session.department === reg.department;
  if (!isAdmin && !isOwnDeptLeader) {
    redirect('/register');
  }

  // Sau khi save, leader về tab Đăng ký tăng ca (/register), admin về Dashboard.
  const backHref = isAdmin
    ? `/dashboard?date=${reg.overtime_date}`
    : '/register';

  const [{ data: items }, { data: employees }, { data: equipments }] = await Promise.all([
    supabaseAdmin
      .from('overtime_items')
      .select(
        'id, employee_id, equipment_id, item_code, item_name, planned_quantity, time_from, time_to, duration_hours',
      )
      .eq('registration_id', id),
    supabaseAdmin
      .from('employees')
      .select('id, full_name, order_no')
      .eq('department', reg.department)
      .order('order_no'),
    supabaseAdmin
      .from('equipments')
      .select('id, code, rpm, spec, machine_type')
      .eq('department', reg.department)
      .order('code'),
  ]);

  return (
    <main className="min-h-screen bg-brand-pattern p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <EditRegistrationForm
          reg={reg}
          items={items ?? []}
          employees={employees ?? []}
          equipments={equipments ?? []}
          backHref={backHref}
        />
      </div>
    </main>
  );
}
