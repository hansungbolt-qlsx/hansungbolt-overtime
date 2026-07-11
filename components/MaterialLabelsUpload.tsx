'use client';

import { useEffect, useRef, useState } from 'react';
import { HD_EMPLOYEES } from '@/lib/hd-employees';
import PrintJobButton from './PrintJobButton';

type Photo = { id: string; url: string | null; uploaded_at: string; employee_name: string | null };

export default function MaterialLabelsUpload({
  date,
  currentUserFullName,
}: {
  date: string;
  currentUserFullName?: string | null;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  // undefined = chưa check localStorage, null = chưa chọn tên, string = đã chọn
  const [employeeName, setEmployeeName] = useState<string | null | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Ưu tiên: tên trong session (nếu match danh sách HD) → localStorage → null
    const matched = currentUserFullName
      ? HD_EMPLOYEES.find((e) => e.full === currentUserFullName)
      : null;
    if (matched) {
      setEmployeeName(matched.display);
      // Cập nhật localStorage để giữ nhất quán nếu user "Đổi tên" sau đó
      localStorage.setItem('hd_employee_name', matched.display);
      return;
    }
    const saved = localStorage.getItem('hd_employee_name');
    setEmployeeName(saved);
  }, [currentUserFullName]);

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

  async function handleDeleteAll() {
    if (!confirm(`Xóa toàn bộ ${photos.length} ảnh ngày ${date}?`)) return;
    setDeletingAll(true);
    try {
      const res = await fetch(`/api/labels?date=${date}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(`Xóa thất bại: ${d.error ?? res.statusText}`);
        return;
      }
      setPhotos([]);
    } finally {
      setDeletingAll(false);
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

  // Đang đọc localStorage — tránh flash màn hình chọn tên
  if (employeeName === undefined) return null;

  // Step 1: Name selector
  if (!employeeName) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden mt-6">
        <div className="bg-[#063882] px-5 py-4">
          <h2 className="text-base font-bold text-white">Chọn tên của bạn</h2>
          <p className="text-xs text-blue-200 mt-0.5">Tên sẽ hiển thị trên tem khi in ra</p>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2">
          {HD_EMPLOYEES.map((emp) => (
            <button
              key={emp.full}
              type="button"
              onClick={() => {
                localStorage.setItem('hd_employee_name', emp.display);
                setEmployeeName(emp.display);
              }}
              className="py-4 rounded-xl bg-[#dce8fa] hover:bg-[#063882] hover:text-white text-[#063882] font-bold text-lg transition active:scale-95 shadow-sm"
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
    <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden mt-6">
      {/* Header */}
      <div className="bg-[#063882] px-5 py-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-white leading-tight">Tem NVL</h2>
          <div className="text-sm font-semibold text-white mt-0.5">Ngày {date}</div>
          <p className="text-xs text-blue-200 mt-1">
            Đang upload với tên:{' '}
            <span className="font-bold text-white">{employeeName}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-xs font-semibold text-blue-200 bg-[#052f6e] px-2 py-1 rounded whitespace-nowrap">
            {photos.length} ảnh
          </span>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('hd_employee_name');
              setEmployeeName(null);
            }}
            className="text-xs text-blue-200 hover:text-white underline transition"
          >
            Đổi tên
          </button>
        </div>
      </div>

      <div className="p-4 bg-[#f0f5ff]">
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
          className={`block w-full py-4 rounded-xl border-2 border-dashed text-center font-bold cursor-pointer transition text-base ${
            uploading
              ? 'border-gray-300 text-gray-400 cursor-not-allowed bg-gray-50'
              : 'border-[#063882] text-[#063882] hover:bg-[#063882] hover:text-white hover:border-solid active:scale-95'
          }`}
        >
          {uploading ? 'Đang upload...' : '+ Chụp / chọn ảnh tem'}
        </label>

        {message && (
          <div
            className={`mt-3 text-sm p-2.5 rounded-lg border ${
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
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative aspect-square bg-white rounded-lg overflow-hidden shadow-sm"
                >
                  {p.url ? (
                    <img
                      src={p.url}
                      alt="Tem NVL"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-brand-navy-soft">
                      (không tải được)
                    </div>
                  )}
                  {p.employee_name && (
                    <span className="absolute bottom-1 right-1 bg-[#063882]/80 text-white text-[10px] font-bold px-1 rounded leading-tight">
                      {p.employee_name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="absolute top-1 right-1 bg-[#e32531] hover:bg-[#c01f2a] disabled:opacity-60 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md"
                    aria-label="Xóa"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <PrintJobButton type="labels_day" refId={date} label="Gửi in tất cả tem" />
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="text-xs text-[#e32531] hover:text-[#c01f2a] font-semibold underline transition disabled:opacity-60"
              >
                {deletingAll ? 'Đang xóa...' : 'Xóa toàn bộ'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
