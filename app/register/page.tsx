import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import LogoutButton from '@/components/LogoutButton';
import RegisterLayout from '@/components/RegisterLayout';
import OvertimeSummaryCard from '@/components/OvertimeSummaryCard';
import { toTitleCase } from '@/lib/format';

export default async function RegisterPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'admin') redirect('/dashboard');
  if (!session.department) redirect('/login');
  const isLeader = session.role === 'leader';

  return (
    <main className="min-h-screen bg-brand-pattern p-4">
      <div className="max-w-lg mx-auto">
        <header className="flex justify-between items-start mb-5 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/logo.png"
              alt="Hansungbolt"
              width={890}
              height={405}
              priority
              unoptimized
              className="h-9 w-auto flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-brand-navy">
                Bộ phận {session.department}
              </h1>
              <p className="text-sm text-brand-navy-soft truncate">{toTitleCase(session.fullName)}</p>
            </div>
          </div>
          <LogoutButton />
        </header>

        <RegisterLayout
          department={session.department}
          isLeader={isLeader}
          currentUserFullName={session.fullName}
        />

        <div className="mt-6">
          <OvertimeSummaryCard />
        </div>
      </div>
    </main>
  );
}
