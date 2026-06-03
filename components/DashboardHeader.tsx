import Image from 'next/image';
import Link from 'next/link';
import LogoutButton from './LogoutButton';
import ChangePasswordButton from './ChangePasswordButton';
import { toTitleCase } from '@/lib/format';

type Tab = 'overview' | 'users';

const TABS: Array<{ key: Tab; label: string; href: string }> = [
  { key: 'overview', label: 'Tổng quan', href: '/dashboard' },
  { key: 'users', label: 'Quản lý tài khoản', href: '/dashboard/users' },
];

export default function DashboardHeader({
  fullName,
  active,
}: {
  fullName: string;
  active: Tab;
}) {
  return (
    <header className="mb-6">
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/logo.png"
            alt="Hansungbolt"
            width={890}
            height={405}
            priority
            unoptimized
            className="h-10 w-auto flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-brand-navy leading-tight">
              Dashboard Admin
            </h1>
            <p className="text-xs md:text-sm text-brand-navy-soft truncate">
              Xin chào {toTitleCase(fullName)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <LogoutButton />
          <ChangePasswordButton />
        </div>
      </div>

      <nav className="flex gap-2 border-b border-brand-surface-alt">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition border border-b-0 ${
                isActive
                  ? 'bg-white text-brand-navy border-brand-surface-alt -mb-px'
                  : 'text-brand-navy-soft border-transparent hover:bg-brand-surface-alt/50 hover:text-brand-navy'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
