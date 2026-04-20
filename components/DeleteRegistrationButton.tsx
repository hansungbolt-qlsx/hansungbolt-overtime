'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteRegistrationButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Xóa phiếu này? Thao tác không thể hoàn tác.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(`Xóa thất bại: ${d.error ?? res.statusText}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="bg-[#e32531] hover:bg-[#c01f2a] disabled:opacity-60 active:scale-95 text-white text-xs font-semibold py-1.5 px-3 rounded-md transition"
    >
      {busy ? '...' : 'Xóa'}
    </button>
  );
}
