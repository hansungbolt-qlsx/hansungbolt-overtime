'use client';

import Link from 'next/link';
import { useGameProgress } from '@/lib/games/useGameProgress';

type Tile = {
  id: string;
  label: string;
  emoji: string;
  href?: string; // có href = đã làm; không = sắp có
  color: string;
};

const TILES: Tile[] = [
  { id: 'dem-so', label: 'Đếm số', emoji: '🔢', href: '/games/dem-so', color: '#42a5f5' },
  { id: 'nghe-so', label: 'Nghe & chọn số', emoji: '👂', href: '/games/nghe-so', color: '#26a69a' },
  { id: 'nhieu-it', label: 'Nhiều hơn / Ít hơn', emoji: '⚖️', href: '/games/nhieu-it', color: '#ab47bc' },
  { id: 'so-sanh-so', label: 'Số lớn / Số bé', emoji: '📊', href: '/games/so-sanh-so', color: '#ef5350' },
  { id: 'tim-khac', label: 'Tìm cái khác', emoji: '🔍', href: '/games/tim-khac', color: '#ff7043' },
  { id: 'gom-giong', label: 'Gom nhóm giống', emoji: '🧩', href: '/games/gom-giong', color: '#66bb6a' },
  { id: 'ke-chuyen', label: 'Kể chuyện', emoji: '📖', color: '#ffa726' },
];

export default function GameHub() {
  const { stars, ready } = useGameProgress();

  return (
    <div
      className="fixed inset-0 overflow-auto select-none"
      style={{
        background:
          'linear-gradient(160deg,#e3f2fd 0%,#fff3e0 50%,#f1f8e9 100%)',
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-3xl font-extrabold text-[#1b3864]">
          🎈 Bé Học
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white/80 rounded-2xl px-4 py-2 shadow">
            <span className="text-3xl">⭐</span>
            <span className="text-3xl font-extrabold text-[#f9a825]">
              {ready ? stars : '…'}
            </span>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-2xl bg-white text-[#1b3864] font-bold shadow border border-[#cdd9e5] active:scale-95"
          >
            Thoát
          </Link>
        </div>
      </div>

      {/* Lưới game */}
      <div className="px-6 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {TILES.map((t) => {
            const ready2 = !!t.href;
            const inner = (
              <div
                className={`relative rounded-3xl border-4 flex flex-col items-center justify-center gap-3 transition active:scale-95 ${
                  ready2 ? 'bg-white shadow-lg' : 'bg-white/50'
                }`}
                style={{
                  borderColor: ready2 ? t.color : '#cfd8dc',
                  aspectRatio: '1 / 1',
                  minHeight: 170,
                }}
              >
                <span style={{ fontSize: '4.5rem', lineHeight: 1 }}>
                  {t.emoji}
                </span>
                <span
                  className="text-xl font-extrabold text-center px-2"
                  style={{ color: ready2 ? '#1b3864' : '#90a4ae' }}
                >
                  {t.label}
                </span>
                {!ready2 && (
                  <span className="absolute top-3 right-3 text-2xl">🔒</span>
                )}
              </div>
            );
            return t.href ? (
              <Link key={t.id} href={t.href}>
                {inner}
              </Link>
            ) : (
              <div key={t.id} aria-disabled className="cursor-default">
                {inner}
              </div>
            );
          })}
        </div>
        <p className="text-center text-sm text-[#607d8b] mt-6">
          🔒 = sắp có. Bố mẹ chọn game cho bé.
        </p>
      </div>
    </div>
  );
}
