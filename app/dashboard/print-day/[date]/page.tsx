import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import PrintDayControls from '@/components/PrintDayControls';
import OvertimeSheetArticle, { OT_PRINT_CSS } from '@/components/OvertimeSheetArticle';

// In GỘP mọi phiếu tăng ca của 1 ngày (HD trước, RL sau) TRỰC TIẾP trên trình
// duyệt PC admin — 1 lệnh in nhiều trang, mỗi phiếu 1 trang A4 (user 16/7,
// thay đường print-agent vì admin ngồi ngay máy nối máy in, chờ ~1' mới ra giấy).
export default async function PrintDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/register');

  const { date } = await params;
  const sp = await searchParams;
  const autoprint = sp.autoprint === '1';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Ngày không hợp lệ.</p>
      </main>
    );
  }

  // HD trước RL (department asc), cùng bộ phận thì phiếu gửi trước in trước
  const { data: regs } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department')
    .eq('overtime_date', date)
    .order('department', { ascending: true })
    .order('created_at', { ascending: true });

  if (!regs || regs.length === 0) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-brand-navy">Ngày {date} chưa có phiếu tăng ca nào.</p>
      </main>
    );
  }

  const depts = Array.from(new Set(regs.map((r) => r.department))).sort().join(' + ');

  return (
    <main className="min-h-screen bg-brand-surface p-4 print:min-h-0 print:p-0 print:bg-white">
      <div className="max-w-5xl mx-auto print:max-w-none">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <p className="text-sm text-brand-navy-soft">
            In gộp phiếu tăng ca ngày <strong>{date}</strong> — {regs.length} phiếu ({depts}),
            mỗi phiếu 1 trang
          </p>
          <PrintDayControls count={regs.length} autoprint={autoprint} />
        </div>

        <div className="flex flex-col gap-8 print:block print:gap-0">
          {regs.map((r, i) => (
            <section
              key={r.id}
              className={i < regs.length - 1 ? 'ot-sheet-break' : undefined}
            >
              <OvertimeSheetArticle regId={r.id} />
            </section>
          ))}
        </div>
      </div>

      <style>{OT_PRINT_CSS}</style>
      <style>{`
        @media print {
          .ot-sheet-break { break-after: page; page-break-after: always; }
        }
      `}</style>
    </main>
  );
}
