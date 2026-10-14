import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import DashboardHeader from '@/components/DashboardHeader';
import GiaCongView from '@/components/GiaCongView';
import { canUseGiaCong } from '@/lib/gia-cong';

// Gia công 70/80 (anh Hữu chốt 14/10/2026): CHỈ tài khoản đăng nhập `qlsx` — lập phiếu đặt / nhập gia công,
// gửi sang app chính (anh Hữu duyệt + Đẩy ERP). Tài khoản anh Cường (vai trò qlsx) mở rộng sau nếu cần.
export default async function GiaCongPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canUseGiaCong(session)) redirect(session.role === 'admin' ? '/dashboard' : '/register');

  return (
    <main className="min-h-screen bg-brand-pattern p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <DashboardHeader fullName={session.fullName} active="gia_cong" username={session.username} />
        <GiaCongView />
      </div>
    </main>
  );
}
