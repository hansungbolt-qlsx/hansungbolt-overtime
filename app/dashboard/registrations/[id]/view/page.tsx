import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import PrintControls from '@/components/PrintControls';
import MobileFitScale from '@/components/MobileFitScale';
import OvertimeSheetArticle, { OT_PRINT_CSS } from '@/components/OvertimeSheetArticle';

// Thân phiếu + CSS in tách sang components/OvertimeSheetArticle.tsx (dùng chung
// với trang in gộp cả ngày /dashboard/print-day) — trang này chỉ còn quyền xem
// + khung điều khiển in/xuất.
export default async function PrintViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const sp = await searchParams;
  const autoprint = sp.autoprint === '1';

  const { data: reg } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department, overtime_date')
    .eq('id', id)
    .maybeSingle();

  if (!reg) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Không tìm thấy phiếu.</p>
      </main>
    );
  }

  // Non-admin chỉ xem phiếu bộ phận mình
  if (session.role !== 'admin' && session.department !== reg.department) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Không có quyền xem phiếu này.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-surface p-4 print:min-h-0 print:p-0 print:bg-white">
      <div className="max-w-5xl mx-auto print:max-w-none">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <div>
            <p className="text-sm text-brand-navy-soft">
              Phiếu ngày {reg.overtime_date} • Bộ phận {reg.department}
            </p>
          </div>
          <PrintControls id={id} autoprint={autoprint} />
        </div>

        {/* Điện thoại (user 11/7): giữ layout giấy A4 chuẩn 760px, scale cả tờ vừa
            bề ngang màn hình như xem PDF — cột không bị bóp méo chữ đè nhau */}
        <div className="ot-fitbox overflow-hidden">
          <OvertimeSheetArticle
            regId={id}
            homeHref={session.role === 'admin' ? '/dashboard' : '/register'}
          />
        </div>
        <MobileFitScale />
      </div>

      <style>{OT_PRINT_CSS}</style>
    </main>
  );
}
