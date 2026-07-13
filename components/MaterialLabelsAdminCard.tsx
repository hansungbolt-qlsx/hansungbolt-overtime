'use client';

import { useEffect, useMemo, useState } from 'react';

type Photo = {
  id: string;
  url: string | null;
  thumb_url: string | null;
  uploaded_at: string;
  employee_name: string | null;
};
type Tab = 'view' | 'download' | 'print';

// Ngày local (giờ máy = giờ VN) dạng YYYY-MM-DD, lùi `offsetDays` ngày.
function ymdLocal(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

export default function MaterialLabelsAdminCard() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('view');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [deletingAll, setDeletingAll] = useState(false);

  // 2 ngày đang được giữ (khớp cron cleanup — user rút 3→2 ngày 13/7 tiết kiệm egress).
  const dayOptions = useMemo(
    () => [
      { label: 'Hôm nay', value: ymdLocal(0) },
      { label: 'Hôm qua', value: ymdLocal(1) },
    ],
    [],
  );
  // Ngày đang xem trong card — LUÔN mặc định hôm nay, độc lập hoàn toàn với
  // bộ lọc ngày của danh sách phiếu phía trên (tem hôm qua chỉ xem khi bấm tab).
  const [day, setDay] = useState(() => ymdLocal(0));

  async function handleDeleteAll() {
    if (!confirm(`Xóa toàn bộ ${photos.length} ảnh ngày ${day}?`)) return;
    setDeletingAll(true);
    try {
      const res = await fetch(`/api/labels?date=${day}`, { method: 'DELETE' });
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

  // Nhấn ESC để đóng ảnh phóng to.
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/labels?date=${day}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPhotos(d.photos ?? []); })
      .catch(() => { if (!cancelled) setPhotos([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [day]);

  const sheetsNeeded = Math.ceil(photos.length / 8) || 0;
  const activeCfg = TABS.find((t) => t.id === tab)!;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-surface-alt overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-surface-alt">
        <h2 className="text-base font-bold text-[#063882] leading-tight">Tem NVL</h2>
        <div className="text-sm font-semibold text-[#063882] mt-0.5">Ngày {day}</div>

        {/* Chọn nhanh 1 trong 3 ngày đang được giữ */}
        <div className="flex gap-2 mt-2">
          {dayOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDay(opt.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                day === opt.value
                  ? 'bg-[#063882] text-white shadow'
                  : 'bg-[#dce8fa] text-[#063882] hover:bg-[#c4d8f5]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-brand-navy-soft mt-2">
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
                      onClick={() => { if (p.url) { setLightbox(p.url); setRotation(0); } }}
                      className="relative aspect-square bg-white rounded-lg overflow-hidden shadow-sm hover:ring-2 hover:ring-[#063882] transition"
                    >
                      {p.url && (
                        // Lưới dùng THUMBNAIL (~20KB) tiết kiệm egress; phóng to mới
                        // tải ảnh full. Thiếu thumb (ảnh cũ) → fallback ảnh full.
                        <img
                          src={p.thumb_url ?? p.url}
                          alt="Tem"
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            if (p.url && e.currentTarget.src !== p.url) {
                              e.currentTarget.src = p.url;
                            }
                          }}
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
                    {/* Thanh điều khiển — chặn click lan ra backdrop */}
                    <div
                      className="absolute top-4 right-4 flex gap-2 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                        className="bg-white/95 hover:bg-white text-[#063882] font-bold text-sm py-2 px-4 rounded-lg shadow active:scale-95 transition"
                      >
                        ↻ Xoay 90°
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightbox(null)}
                        className="bg-white/95 hover:bg-white text-[#c01f2a] font-bold text-sm py-2 px-4 rounded-lg shadow active:scale-95 transition"
                      >
                        ✕ Đóng
                      </button>
                    </div>
                    <img
                      src={lightbox}
                      alt="Tem NVL zoom"
                      onClick={(e) => e.stopPropagation()}
                      style={{ transform: `rotate(${rotation}deg)` }}
                      className="max-w-full max-h-full object-contain transition-transform duration-200 cursor-default"
                    />
                    <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs">
                      Nhấn ESC để đóng · ↻ để xoay đúng chiều
                    </span>
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
                  href={`/api/labels/export?date=${day}`}
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
                  onClick={() => window.open(`/print/labels?date=${day}`, '_blank')}
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
