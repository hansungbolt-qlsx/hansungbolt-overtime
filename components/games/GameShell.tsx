'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

// Khung chung cho mọi game: nền, top bar (tên · sao · lượt mới · thoát),
// vùng chơi flex-1. Game truyền `stars` (tự quản qua useGameProgress).
export default function GameShell({
  title,
  stars,
  starsReady,
  onNewRound,
  newRoundLabel = 'Lượt mới',
  instruction,
  onSpeak,
  children,
}: {
  title: string;
  stars: number;
  starsReady: boolean;
  onNewRound?: () => void;
  newRoundLabel?: string;
  instruction?: string;
  onSpeak?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none touch-none"
      style={{
        background:
          'linear-gradient(160deg,#e3f2fd 0%,#fff3e0 50%,#f1f8e9 100%)',
      }}
    >
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 flex-wrap">
        <div className="text-lg sm:text-2xl font-extrabold text-[#1b3864] whitespace-nowrap">
          {title}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/80 rounded-xl px-2.5 py-1 shadow">
            <span className="text-xl">⭐</span>
            <span className="text-xl font-extrabold text-[#f9a825]">
              {starsReady ? stars : '…'}
            </span>
          </div>
          {onNewRound && (
            <button
              type="button"
              onClick={onNewRound}
              className="px-3 py-1.5 rounded-xl bg-[#a3c947] text-[#1b3864] font-bold text-sm shadow active:scale-95"
            >
              {newRoundLabel}
            </button>
          )}
          <Link
            href="/games"
            className="px-3 py-1.5 rounded-xl bg-white text-[#1b3864] font-bold text-sm shadow border border-[#cdd9e5] active:scale-95"
          >
            Thoát
          </Link>
        </div>
      </div>

      {instruction && (
        <div className="shrink-0 flex items-center justify-center gap-3 px-4 pb-1">
          <p className="text-xl sm:text-3xl font-extrabold text-[#1b3864] text-center">
            {instruction}
          </p>
          {onSpeak && (
            <button
              type="button"
              onClick={onSpeak}
              aria-label="Nghe lại"
              className="text-3xl bg-white/80 rounded-full w-12 h-12 flex items-center justify-center shadow active:scale-90"
            >
              🔊
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex items-stretch gap-3 px-3 pb-3">
        {children}
      </div>
    </div>
  );
}
