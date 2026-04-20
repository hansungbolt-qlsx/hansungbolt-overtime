'use client';

import { useEffect, useState } from 'react';

type Photo = { id: string; url: string | null; uploaded_at: string; employee_name: string | null };
type Tab = 'view' | 'download' | 'print';

const TABS: {
  id: Tab;
  label: string;
  activeCls: string;
  inactiveCls: string;
  bgCls: string;
}[] = [
  {
    id: 'view',
    label: 'Xem ảnh',
    activeCls: 'bg-[#063882] text-white shadow',
    inactiveCls: 'bg-[#dce8fa] text-[#063882] hover:bg-[#c4d8f5]',
    bgCls: 'bg-[#f0f5ff]',
  },
  {
    id: 'download',
    label: 'Tải Excel',
    activeCls: 'bg-[#2db5a1] text-white shadow',
    inactiveCls: 'bg-[#d1f4ef] text-[#0a7f70] hover:bg-[#b8ece6]',
    bgCls: 'bg-[#f0faf9]',
  },
  {
    id: 'print',
    label: 'In tem',
    activeCls: 'bg-[#e32531] text-white shadow',
    inactiveCls: 'bg-[#fde8e9] text-[#c01f2a] hover:bg-[#fcd0d2]',
    bgCls: 'bg-[#fff5f5]',
  },
];

export default function MaterialLabelsAdminCard({ date }: { date: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('view');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/labels?date=${date}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPhotos(d.photos ?? []); })
      .catch(() => { if (!cancelled) setPhotos([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const sheetsNeeded = Math.ceil(photos.length / 8) || 0;
  const activeCfg = TABS.find((t) => t.id === tab)!;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-surface-alt">
        <h2 className="text-base font-bold text-[#063882]">Tem NVL ngày {date}</h2>
        <p className="text-xs text-brand-navy-soft mt-0.5">
          {loading
            ? 'Đang tải...'
            : photos.length === 0
              ? 'Chưa có tem nào'
              : `${photos.length} ảnh — ${sheetsNeeded} tờ in (8 ảnh/tờ)`}
        </p>
      </div>

      {photos.length > 0 && (
        <>
          {/* Tab bar */}
          <div className="flex gap-2 px-3 pt-3 bg-white">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 rounded-t-xl text-sm font-bold transition active:scale-95 ${
                  tab === t.id ? t.activeCls : t.inactiveCls
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className={`p-4 min-h-[160px] ${activeCfg.bgCls}`}>
            {tab === 'view' && (
              <>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                  {photos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => p.url && setLightbox(p.url)}
                      className="relative aspect-square bg-white rounded-lg overflow-hidden shadow-sm hover:ring-2 hover:ring-[#063882] transition"
                    >
                      {p.url && (
                        <img
                          src={p.url}
                          alt="Tem"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      {p.employee_name && (
                        <span className="absolute bottom-0.5 right-0.5 bg-[#063882]/80 text-white text-[9px] font-bold px-1 py-px rounded leading-tight">
                          {p.employee_name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDeleteAll}
                    disabled={deletingAll}
                    className="text-xs text-[#e32531] hover:text-[#c01f2a] font-semibold underline transition disabled:opacity-60"
                  >
                    {deletingAll ? 'Đang xóa...' : 'Xóa toàn bộ'}
                  </button>
                </div>
                {lightbox && (
                  <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setLightbox(null)}
                  >
                    <img
                      src={lightbox}
                      alt="Tem NVL zoom"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </>
            )}

            {tab === 'download' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <p className="text-sm text-[#0a7f70] font-medium text-center">
                  {photos.length} ảnh — {sheetsNeeded} trang Excel, mỗi trang 2×4 ảnh khổ A4
                </p>
                <a
                  href={`/api/labels/export?date=${date}`}
                  className="bg-[#2db5a1] hover:bg-[#0f9080] active:scale-95 text-white font-bold py-3 px-8 rounded-xl shadow-md transition text-sm"
                >
                  Tải Excel (.xlsx)
                </a>
              </div>
            )}

            {tab === 'print' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <p className="text-sm text-[#c01f2a] font-medium text-center">
                  {photos.length} ảnh — {sheetsNeeded} tờ A4, lưới 2×4, tự mở hộp thoại in
                </p>
                <button
                  type="button"
                  onClick={() => window.open(`/print/labels?date=${date}`, '_blank')}
                  className="bg-[#e32531] hover:bg-[#c01f2a] active:scale-95 text-white font-bold py-3 px-8 rounded-xl shadow-md transition text-sm"
                >
                  Mở trang in
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
