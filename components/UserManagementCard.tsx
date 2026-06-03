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
  const [addOpen, setAddOpen] = useState(false);

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
      <div className="px-5 py-4 border-b border-brand-surface-alt flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-brand-navy">Quản lý tài khoản</h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Thêm nhân viên mới, reset mật khẩu (về &quot;hd123&quot;) hoặc xóa user khi nhân viên nghỉ việc
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-semibold text-brand-navy-soft hidden sm:inline">
            {users.length} tài khoản
          </span>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="text-xs px-3 py-1.5 bg-[#063882] hover:bg-[#052a64] text-white font-semibold rounded transition active:scale-95"
          >
            + Thêm nhân viên
          </button>
        </div>
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
      {addOpen && (
        <AddUserModal
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            setAddOpen(false);
            await load();
          }}
        />
      )}
    </section>
  );
}

function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [department, setDepartment] = useState<'HD' | 'RL'>('HD');
  const [role, setRole] = useState<'worker' | 'leader'>('worker');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const fn = fullName.trim();
    const un = username.trim().toLowerCase();
    if (!fn) { setErr('Vui lòng nhập họ tên'); return; }
    if (!un || !/^[a-z0-9]+$/.test(un)) {
      setErr('Username chỉ chứa chữ thường (a-z) và số, không dấu, không khoảng trắng');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fn,
          username: un,
          role,
          department,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) {
        setErr(d.error ?? `Lỗi ${res.status}`);
        return;
      }
      if (d.warning) {
        alert(d.warning);
      } else {
        alert(`Đã tạo tài khoản ${un} (mật khẩu: hd123)`);
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5"
      >
        <h3 className="text-lg font-bold text-brand-navy mb-4">Thêm nhân viên mới</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1">
              Họ và tên <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="VD: Nguyễn Văn A"
              className="w-full px-3 py-2 text-sm border border-brand-surface-alt rounded focus:outline-none focus:border-[#063882]"
              autoFocus
              required
            />
            <p className="text-[11px] text-brand-navy-soft mt-1">
              Lưu trữ ở dạng IN HOA, hiển thị Title Case.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1">
              Username <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              placeholder="VD: nguyenvana"
              className="w-full px-3 py-2 text-sm border border-brand-surface-alt rounded font-mono focus:outline-none focus:border-[#063882]"
              required
            />
            <p className="text-[11px] text-brand-navy-soft mt-1">
              Chữ thường liền, không dấu, không khoảng trắng.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1">Bộ phận</label>
            <div className="flex gap-2">
              {(['HD', 'RL'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDepartment(d)}
                  className={`flex-1 py-2 text-sm font-semibold rounded border transition ${
                    department === d
                      ? 'bg-[#063882] text-white border-[#063882]'
                      : 'bg-white text-brand-navy border-brand-surface-alt hover:bg-[#f0f5ff]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1">Vai trò</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole('worker')}
                className={`flex-1 py-2 text-sm font-semibold rounded border transition ${
                  role === 'worker'
                    ? 'bg-[#063882] text-white border-[#063882]'
                    : 'bg-white text-brand-navy border-brand-surface-alt hover:bg-[#f0f5ff]'
                }`}
              >
                Nhân viên
              </button>
              <button
                type="button"
                onClick={() => setRole('leader')}
                className={`flex-1 py-2 text-sm font-semibold rounded border transition ${
                  role === 'leader'
                    ? 'bg-[#2db5a1] text-white border-[#2db5a1]'
                    : 'bg-white text-brand-navy border-brand-surface-alt hover:bg-[#f0f5ff]'
                }`}
              >
                Tổ trưởng/phó
              </button>
            </div>
          </div>

          <div className="bg-[#f0f5ff] rounded px-3 py-2 text-xs text-[#063882]">
            Mật khẩu mặc định: <strong className="font-mono">hd123</strong>. NV cũng được thêm
            vào danh sách bộ phận {department} để xuất hiện trong phiếu đăng ký tăng ca.
          </div>

          {err && (
            <div className="bg-[#fde8e9] border border-[#fcd0d2] text-[#c01f2a] text-xs px-3 py-2 rounded">
              {err}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 text-sm font-semibold rounded border border-brand-surface-alt text-brand-navy hover:bg-[#f0f5ff] disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 text-sm font-semibold rounded bg-[#063882] text-white hover:bg-[#052a64] disabled:opacity-60"
          >
            {saving ? 'Đang lưu...' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </div>
  );
}
