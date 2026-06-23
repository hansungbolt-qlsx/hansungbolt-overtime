import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import LogoutButton from '@/components/LogoutButton';
import ChangePasswordButton from '@/components/ChangePasswordButton';
import RegisterLayout from '@/components/RegisterLayout';
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
        <header className="flex justify-between items-center mb-5 gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href="/register"
              aria-label="Về trang chủ"
              className="relative h-11 w-12 overflow-hidden flex-shrink-0 active:scale-95 transition"
            >
              <Image
                src="/logo.png"
                alt="Hansungbolt"
                width={890}
                height={405}
                priority
                unoptimized
                className="absolute max-w-none"
                style={{ width: '160px', height: 'auto', left: '-56px', top: '0' }}
              />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-brand-navy leading-tight whitespace-nowrap">
                Bộ phận {session.department}
              </h1>
              <p className="text-xs text-brand-navy-soft truncate">
                Xin chào {toTitleCase(session.fullName)}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <LogoutButton />
            <ChangePasswordButton />
          </div>
        </header>

        <RegisterLayout
          department={session.department}
          isLeader={isLeader}
          currentUserFullName={session.fullName}
        />
      </div>
    </main>
  );
}
