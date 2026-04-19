'use client';

import { useEffect, useState } from 'react';

type Photo = { id: string; url: string | null; uploaded_at: string };

export default function MaterialLabelsAdminCard({ date }: { date: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/labels?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setPhotos(d.photos ?? []);
      })
      .catch(() => !cancelled && setPhotos([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const sheetsNeeded = Math.ceil(photos.length / 8) || 0;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
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
          <a
            href={`/api/labels/export?date=${date}`}
            className="text-sm bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold py-2 px-4 rounded-md shadow-md shadow-brand-teal/30 transition whitespace-nowrap"
          >
            Tải Excel in
          </a>
        )}
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => p.url && setLightbox(p.url)}
              className="aspect-square bg-brand-surface-alt rounded overflow-hidden hover:ring-2 hover:ring-brand-teal transition"
            >
              {p.url ? (
                <img
                  src={p.url}
                  alt="Tem"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </button>
          ))}
        </div>
      )}

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
    </section>
  );
}
