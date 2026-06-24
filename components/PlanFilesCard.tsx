'use client';

import { useEffect, useState } from 'react';

type PlanFile = {
  id: string;
  plan_date: string;
  file_name: string;
  sheet_name: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
};

function formatDateVN(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatUploadedAt(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function PlanFilesCard() {
  const [files, setFiles] = useState<PlanFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/plan-files');
      const d = await res.json();
      setFiles(d.files ?? []);
      setWarning(d.warning ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-5">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">
            Kế hoạch đã tải lên
          </h2>
          <p className="text-xs text-brand-navy-soft mt-0.5">
            Giữ 3 file gần nhất. Tải về để xem định dạng Excel gốc.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs px-2.5 py-1 text-brand-navy-soft hover:text-brand-navy border border-brand-surface-alt rounded transition"
        >
          Tải lại
        </button>
      </div>

      {warning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded mb-3">
          {warning}
        </div>
      )}

      {loading && (
        <p className="text-sm text-brand-navy-soft text-center py-4">Đang tải...</p>
      )}

      {!loading && files.length === 0 && !warning && (
        <p className="text-sm text-brand-navy-soft text-center py-4">
          Chưa có file nào. Upload kế hoạch để bắt đầu lưu.
        </p>
      )}

      {!loading && files.length > 0 && (
        <ul className="divide-y divide-brand-surface-alt">
          {files.map((f) => (
            <li key={f.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-brand-navy">
                  Ngày {formatDateVN(f.plan_date)}
                </div>
                <div className="text-xs text-brand-navy-soft truncate" title={f.file_name}>
                  {f.file_name}
                  {f.sheet_name && (
                    <span className="ml-1 text-brand-navy-soft">
                      • sheet {f.sheet_name}
                    </span>
                  )}
                  {f.file_size_bytes && (
                    <span className="ml-1 text-brand-navy-soft">
                      • {formatSize(f.file_size_bytes)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-brand-navy-soft mt-0.5">
                  Upload {formatUploadedAt(f.uploaded_at)}
                </div>
              </div>
              <a
                href={`/api/plan-files/${f.id}/download`}
                className="flex-shrink-0 text-xs bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold py-1.5 px-3 rounded-md shadow-sm transition active:scale-95"
              >
                Tải Excel
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
