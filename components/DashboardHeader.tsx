import Image from 'next/image';
import Link from 'next/link';
import LogoutButton from './LogoutButton';
import ChangePasswordButton from './ChangePasswordButton';
import { toTitleCase } from '@/lib/format';

type Tab = 'overview' | 'users' | 'qlsx' | 'stops' | 'gia_cong';

const TABS: Array<{ key: Tab; label: string; href: string }> = [
  { key: 'overview', label: 'Tổng quan', href: '/dashboard' },
  { key: 'users', label: 'Quản lý tài khoản', href: '/dashboard/users' },
  { key: 'qlsx', label: 'Tăng ca QLSX', href: '/dashboard/qlsx' },
  { key: 'stops', label: 'Máy dừng hôm nay', href: '/dashboard/stop-reasons' },
  // Gia công 70/80 (anh Hữu chốt 14/10/2026): CHỈ tài khoản đăng nhập `qlsx` — xem lib/gia-cong.ts canUseGiaCong
  { key: 'gia_cong', label: '🏭 Gia công', href: '/dashboard/gia-cong' },
];

export default function DashboardHeader({
  fullName,
  active,
  username,
}: {
  fullName: string;
  active: Tab;
  username?: string;
}) {
  return (
    <header className="mb-6">
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" aria-label="Về trang chủ" className="flex-shrink-0 active:scale-95 transition">
            <Image
              src="/logo.png"
              alt="Hansungbolt"
              width={890}
              height={405}
              priority
              unoptimized
              className="h-10 w-auto"
            />
          </Link>
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

      {/* Anh Hữu 14/10/2026: app tăng ca dùng trên điện thoại — giao diện nằm gọn 100 % bề ngang, không vuốt trái/phải */}
      <nav className="grid grid-cols-3 gap-1 sm:flex sm:gap-2 border-b border-brand-surface-alt">
        {TABS.filter((t) => t.key !== 'gia_cong' || username === 'qlsx').map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`px-2 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-sm leading-tight text-center font-semibold rounded-t-lg transition border border-b-0 ${
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
