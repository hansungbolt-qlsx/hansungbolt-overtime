'use client';

import { useEffect, useState } from 'react';
import { toTitleCase } from '@/lib/format';

type User = {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'leader' | 'worker';
  department: 'HD' | 'RL' | null;
  password_plain: string | null;
  created_at: string;
};

const ROLE_LABEL: Record<User['role'], string> = {
  admin: 'Admin',
  leader: 'Tổ trưởng/phó',
  worker: 'Nhân viên',
};

const ROLE_BADGE: Record<User['role'], string> = {
  admin: 'bg-[#063882] text-white',
  leader: 'bg-[#2db5a1] text-white',
  worker: 'bg-[#dce8fa] text-[#063882]',
};

export default function UserManagementCard() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const d = await res.json();
      setUsers(d.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleResetPassword(u: User) {
    if (!confirm(`Reset mật khẩu của ${toTitleCase(u.full_name)} về "hd123"?`)) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}/reset-password`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) {
        alert(`Lỗi: ${d.error ?? res.statusText}`);
        return;
      }
      alert(`Đã reset. Mật khẩu mới: ${d.password}`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(u: User) {
    if (!confirm(`XÓA tài khoản ${toTitleCase(u.full_name)} (${u.username})?\nThao tác này không thể hoàn tác.`)) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Xóa thất bại: ${d.error ?? res.statusText}`);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  // Group by department
  const grouped: Record<string, User[]> = {};
  for (const u of users) {
    const key = u.role === 'admin' ? 'Admin' : (u.department ?? 'Khác');
    (grouped[key] ??= []).push(u);
  }
  const order = ['Admin', 'HD', 'RL'];
  const sortedKeys = Object.keys(grouped).sort(
    (a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)),
  );

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-surface-alt flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Quản lý tài khoản</h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Reset mật khẩu (về &quot;hd123&quot;) hoặc xóa user khi nhân viên nghỉ việc
          </p>
        </div>
        <span className="text-xs font-semibold text-brand-navy-soft">
          {users.length} tài khoản
        </span>
      </div>

      <div className="divide-y divide-brand-surface-alt">
        {loading && (
          <p className="text-sm text-brand-navy-soft text-center py-6">Đang tải...</p>
        )}
        {!loading && sortedKeys.map((key) => (
          <div key={key} className="bg-[#f0f5ff]">
            <div className="px-5 py-2 text-xs font-bold text-[#063882] uppercase tracking-wide">
              {key === 'Admin' ? 'Admin QLSX' : `Bộ phận ${key}`}
            </div>
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-sm">
                <thead className="bg-brand-surface-alt text-brand-navy text-xs">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Họ và tên</th>
                    <th className="text-left px-4 py-2 font-semibold">Username</th>
                    <th className="text-left px-4 py-2 font-semibold">Mật khẩu</th>
                    <th className="text-left px-4 py-2 font-semibold">Vai trò</th>
                    <th className="text-right px-4 py-2 font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-surface-alt">
                  {grouped[key].map((u) => (
                    <tr key={u.id} className="hover:bg-[#f0f5ff]/50">
                      <td className="px-4 py-2.5 font-semibold text-brand-navy">
                        {toTitleCase(u.full_name)}
                      </td>
                      <td className="px-4 py-2.5 text-brand-navy-soft font-mono">
                        {u.username}
                      </td>
                      <td className="px-4 py-2.5 text-brand-navy font-mono">
                        {u.password_plain ?? <span className="italic text-brand-navy-soft text-xs">(không rõ)</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${ROLE_BADGE[u.role]}`}>
                          {ROLE_LABEL[u.role]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleResetPassword(u)}
                            disabled={busyId === u.id}
                            className="text-xs px-2.5 py-1 bg-[#dce8fa] hover:bg-[#c4d8f5] disabled:opacity-60 text-[#063882] font-semibold rounded transition"
                          >
                            Reset MK
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleDelete(u)}
                              disabled={busyId === u.id}
                              className="text-xs px-2.5 py-1 bg-[#fde8e9] hover:bg-[#fcd0d2] disabled:opacity-60 text-[#c01f2a] font-semibold rounded transition"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
