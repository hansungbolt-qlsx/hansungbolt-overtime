import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import DashboardHeader from '@/components/DashboardHeader';
import UserManagementCard from '@/components/UserManagementCard';

export default async function DashboardUsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/register');

  return (
    <main className="min-h-screen bg-brand-pattern p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <DashboardHeader fullName={session.fullName} active="users" />
        <UserManagementCard />
      </div>
    </main>
  );
}
