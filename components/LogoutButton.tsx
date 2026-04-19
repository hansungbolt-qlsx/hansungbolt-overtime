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
      className="text-sm px-3 py-2 border border-brand-surface-alt rounded-md text-brand-navy hover:bg-brand-surface-alt disabled:opacity-60 transition"
    >
      {loading ? 'Đang thoát...' : 'Đăng xuất'}
    </button>
  );
}
