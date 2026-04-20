import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import LogoutButton from '@/components/LogoutButton';
import RegisterLayout from '@/components/RegisterLayout';
import OvertimeSummaryCard from '@/components/OvertimeSummaryCard';

export default async function RegisterPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'leader' || !session.department) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-brand-pattern p-4">
      <div className="max-w-lg mx-auto">
        <header className="flex justify-between items-start mb-5 gap-4">
          <div>
            <h1 className="text-xl font-bold text-brand-navy">
              Bộ phận {session.department}
            </h1>
            <p className="text-sm text-brand-navy-soft">{session.fullName}</p>
          </div>
          <LogoutButton />
        </header>

        <RegisterLayout department={session.department} />

        <div className="mt-6">
          <OvertimeSummaryCard />
        </div>
      </div>
    </main>
  );
}
