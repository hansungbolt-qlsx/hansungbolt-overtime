'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={onLogout}
      disabled={loading}
      className="text-xs px-2.5 py-1.5 border border-brand-surface-alt rounded-md text-brand-navy hover:bg-brand-surface-alt disabled:opacity-60 transition whitespace-nowrap"
    >
      {loading ? 'Đang thoát...' : 'Đăng xuất'}
    </button>
  );
}
