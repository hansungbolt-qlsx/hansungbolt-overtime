'use client';

import { useEffect, useState } from 'react';

type Photo = { id: string; url: string | null; uploaded_at: string };
type Tab = 'view' | 'download' | 'print';

export default function MaterialLabelsAdminCard({ date }: { date: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('view');
  const [lightbox, setLightbox] = useState<string | null>(null);

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

  const tabCls = (t: Tab) =>
    `py-2 rounded-lg text-sm font-semibold transition flex-1 ${
      tab === t
        ? 'bg-white text-brand-navy shadow-sm'
        : 'text-brand-navy-soft hover:text-brand-navy'
    }`;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-5">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-brand-navy">Tem NVL ngày {date}</h2>
        <p className="text-sm text-brand-navy-soft">
          {loading
            ? 'Đang tải...'
            : photos.length === 0
              ? 'Chưa có tem nào'
              : `${photos.length} ảnh • ${sheetsNeeded} tờ in (8 ảnh/tờ)`}
        </p>
      </div>

      {photos.length > 0 && (
        <>
          <div className="flex gap-1 bg-brand-surface-alt rounded-xl p-1 mb-4">
            <button type="button" onClick={() => setTab('view')} className={tabCls('view')}>
              Xem
            </button>
            <button type="button" onClick={() => setTab('download')} className={tabCls('download')}>
              Tải xuống
            </button>
            <button type="button" onClick={() => setTab('print')} className={tabCls('print')}>
              In
            </button>
          </div>

          {tab === 'view' && (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => p.url && setLightbox(p.url)}
                    className="aspect-square bg-brand-surface-alt rounded overflow-hidden hover:ring-2 hover:ring-brand-teal transition"
                  >
                    {p.url ? (
                      <img src={p.url} alt="Tem" className="w-full h-full object-cover" loading="lazy" />
                    ) : null}
                  </button>
                ))}
              </div>
              {lightbox && (
                <div
                  className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-zoom-out"
                  onClick={() => setLightbox(null)}
                >
                  <img src={lightbox} alt="Tem NVL zoom" className="max-w-full max-h-full object-contain" />
                </div>
              )}
            </>
          )}

          {tab === 'download' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-brand-navy-soft text-center">
                Xuất {photos.length} ảnh thành file Excel ({sheetsNeeded} trang), mỗi trang 2×4 ảnh.
              </p>
              <a
                href={`/api/labels/export?date=${date}`}
                className="bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold py-2.5 px-6 rounded-md shadow-md shadow-brand-teal/30 transition text-sm"
              >
                Tải Excel (.xlsx)
              </a>
            </div>
          )}

          {tab === 'print' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-brand-navy-soft text-center">
                Mở trang in — ảnh xếp lưới 2×4 trên giấy A4, tự động hiện hộp thoại in.
              </p>
              <button
                type="button"
                onClick={() => window.open(`/print/labels?date=${date}`, '_blank')}
                className="bg-brand-navy hover:bg-brand-navy-soft text-white font-semibold py-2.5 px-6 rounded-md transition text-sm"
              >
                Mở trang in
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
