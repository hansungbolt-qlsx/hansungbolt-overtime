'use client';

import { useEffect, useRef, useState } from 'react';
import { HD_EMPLOYEES } from '@/lib/hd-employees';

type Photo = { id: string; url: string | null; uploaded_at: string; employee_name: string | null };

export default function MaterialLabelsUpload({ date }: { date: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadPhotos() {
    setLoading(true);
    try {
      const res = await fetch(`/api/labels?date=${date}`);
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPhotos();
  }, [date]);

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('date', date);
    if (employeeName) formData.append('employee_name', employeeName);
    for (const f of files) formData.append('files', f);

    try {
      const res = await fetch('/api/labels', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: 'error', text: data.error || 'Upload thất bại' });
      } else {
        const warns = (data.warnings as string[]) ?? [];
        const text =
          warns.length > 0
            ? `Đã upload ${data.uploaded}/${data.total} ảnh. Cảnh báo: ${warns.join('; ')}`
            : `Đã upload ${data.uploaded} ảnh.`;
        setMessage({ kind: warns.length > 0 ? 'error' : 'info', text });
        await loadPhotos();
      }
    } catch {
      setMessage({ kind: 'error', text: 'Không kết nối được máy chủ' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Xóa tem này?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/labels/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(`Xóa thất bại: ${d.error ?? res.statusText}`);
        return;
      }
      await loadPhotos();
    } finally {
      setDeletingId(null);
    }
  }

  // Step 1: Name selector
  if (!employeeName) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 mt-6">
        <h2 className="text-base font-semibold text-brand-navy mb-1">Chọn tên của bạn</h2>
        <p className="text-xs text-brand-navy-soft mb-4">Tên sẽ hiển thị trên tem khi in ra</p>
        <div className="grid grid-cols-2 gap-2">
          {HD_EMPLOYEES.map((emp) => (
            <button
              key={emp.full}
              type="button"
              onClick={() => setEmployeeName(emp.display)}
              className="py-4 rounded-xl bg-brand-surface-alt hover:bg-brand-teal hover:text-white text-brand-navy font-bold text-lg transition active:scale-95"
            >
              {emp.display}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Upload form
  return (
    <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Tem NVL ngày {date}</h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Đang upload với tên:{' '}
            <span className="font-bold text-brand-teal">{employeeName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-brand-navy-soft bg-brand-surface-alt px-2 py-1 rounded">
            {photos.length} ảnh
          </span>
          <button
            type="button"
            onClick={() => setEmployeeName(null)}
            className="text-xs text-brand-navy-soft hover:text-brand-navy underline"
          >
            Đổi tên
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        capture="environment"
        onChange={onFilesSelected}
        disabled={uploading}
        className="hidden"
        id="material-file-input"
      />
      <label
        htmlFor="material-file-input"
        className={`block w-full py-3 rounded-md border-2 border-dashed text-center font-medium cursor-pointer transition ${
          uploading
            ? 'border-gray-300 text-gray-400 cursor-not-allowed'
            : 'border-brand-teal text-brand-teal hover:bg-brand-teal/5'
        }`}
      >
        {uploading ? 'Đang upload...' : '+ Thêm ảnh tem (có thể chọn nhiều)'}
      </label>

      {message && (
        <div
          className={`mt-3 text-sm p-2.5 rounded-md border ${
            message.kind === 'error'
              ? 'text-red-600 bg-red-50 border-red-200'
              : 'text-green-700 bg-green-50 border-green-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading && photos.length === 0 && (
        <p className="text-sm text-brand-navy-soft text-center py-4">Đang tải...</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square bg-brand-surface-alt rounded-md overflow-hidden group"
            >
              {p.url ? (
                <img src={p.url} alt="Tem NVL" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-brand-navy-soft">
                  (không tải được)
                </div>
              )}
              {p.employee_name && (
                <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-bold px-1 rounded leading-tight">
                  {p.employee_name}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md"
                aria-label="Xóa"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
