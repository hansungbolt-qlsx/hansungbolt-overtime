import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import DashboardHeader from '@/components/DashboardHeader';
import StopReasonsView from '@/components/StopReasonsView';

// Máy dừng hôm nay trên tài khoản ADMIN (user 20/7): cùng màn hình với tổ
// trưởng nhưng thấy TOÀN BỘ máy (HD + RL + SM + CT), sửa không giới hạn ngày
// (admin là van ngoại lệ). Dữ liệu chung 1 bảng — admin và tổ trưởng nhìn
// cùng một trạng thái realtime.
export default async function AdminStopReasonsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/register');

  return (
    <main className="min-h-screen bg-brand-pattern p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <DashboardHeader fullName={session.fullName} active="stops" />
        <StopReasonsView />
      </div>
    </main>
  );
}
