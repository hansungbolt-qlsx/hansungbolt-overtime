'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { Story } from '@/lib/games/storyData';
import Scenery from './story/Scenery';
import Celebrate from './Celebrate';
import { useGameProgress } from '@/lib/games/useGameProgress';
import { playSound } from '@/lib/game-audio';

export default function StoryReader({ story }: { story: Story }) {
  const { addStar } = useGameProgress();
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const startX = useRef<number | null>(null);

  const last = story.pages.length - 1;
  const p = story.pages[page];

  function go(delta: number) {
    setPage((cur) => Math.min(last, Math.max(0, cur + delta)));
  }

  function finish() {
    if (done) return;
    setDone(true);
    addStar('ke-chuyen');
    playSound('win');
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: 'linear-gradient(160deg,#fff8e1,#e3f2fd)' }}
    >
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2">
        <div className="text-lg sm:text-2xl font-extrabold text-[#1b3864]">
          {story.emoji} {story.title}
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-white/80 rounded-xl px-3 py-1 text-sm font-bold text-[#3b5788] shadow">
            Trang {page + 1}/{story.pages.length}
          </span>
          <Link
            href="/games/ke-chuyen"
            className="px-3 py-1.5 rounded-xl bg-white text-[#1b3864] font-bold text-sm shadow border border-[#cdd9e5] active:scale-95"
          >
            Thoát
          </Link>
        </div>
      </div>

      {/* Tranh — vuốt trái/phải để lật trang */}
      <div
        className="flex-1 min-h-0 mx-3 rounded-3xl overflow-hidden border-4 border-white shadow-inner bg-white"
        onPointerDown={(e) => {
          startX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (startX.current == null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (dx < -60) go(1);
          else if (dx > 60) go(-1);
        }}
      >
        <Scenery scene={p.scene} />
      </div>

      {/* Lời kể */}
      <div className="shrink-0 mx-3 my-2 bg-white/90 rounded-2xl px-5 py-3 shadow">
        <p className="text-xl sm:text-2xl leading-relaxed text-[#1b3864] font-semibold text-center">
          {p.text}
        </p>
      </div>

      {/* Điều hướng */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 pb-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={page === 0}
          className="px-5 py-3 rounded-2xl bg-white text-[#1b3864] font-extrabold text-lg shadow border border-[#cdd9e5] disabled:opacity-40 active:scale-95"
        >
          ◀ Trước
        </button>

        {page < last ? (
          <button
            type="button"
            onClick={() => go(1)}
            className="px-7 py-3 rounded-2xl bg-[#42a5f5] text-white font-extrabold text-lg shadow active:scale-95"
          >
            Sau ▶
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            className="px-7 py-3 rounded-2xl bg-[#a3c947] text-[#1b3864] font-extrabold text-lg shadow active:scale-95"
          >
            Hết truyện 🎉
          </button>
        )}
      </div>

      {done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <Celebrate show />
          <div className="relative z-50 bg-white rounded-3xl shadow-2xl px-8 py-6 text-center max-w-md mx-4">
            <p className="text-2xl font-extrabold text-[#1b3864] mb-2">
              Hết truyện rồi! ⭐
            </p>
            <p className="text-lg text-[#3b5788] mb-4 italic">
              Bài học: {story.moral}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setDone(false);
                  setPage(0);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#42a5f5] text-white font-bold shadow active:scale-95"
              >
                Đọc lại
              </button>
              <Link
                href="/games/ke-chuyen"
                className="px-5 py-2.5 rounded-xl bg-white text-[#1b3864] font-bold shadow border border-[#cdd9e5] active:scale-95"
              >
                Truyện khác
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
