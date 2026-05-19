'use client';

import Link from 'next/link';
import { STORIES } from '@/lib/games/storyData';

export default function StoryList() {
  return (
    <div
      className="fixed inset-0 overflow-auto select-none"
      style={{
        background:
          'linear-gradient(160deg,#fff3e0 0%,#e3f2fd 50%,#f1f8e9 100%)',
      }}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-3xl font-extrabold text-[#1b3864]">📖 Kể chuyện</h1>
        <Link
          href="/games"
          className="px-4 py-2 rounded-2xl bg-white text-[#1b3864] font-bold shadow border border-[#cdd9e5] active:scale-95"
        >
          Thoát
        </Link>
      </div>
      <div className="px-6 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {STORIES.map((s) => (
            <Link key={s.id} href={`/games/ke-chuyen/${s.id}`}>
              <div
                className="rounded-3xl border-4 border-[#ffa726] bg-white shadow-lg flex flex-col items-center justify-center gap-3 p-4 transition active:scale-95"
                style={{ aspectRatio: '1 / 1', minHeight: 170 }}
              >
                <span style={{ fontSize: '4.5rem', lineHeight: 1 }}>
                  {s.emoji}
                </span>
                <span className="text-lg font-extrabold text-center text-[#1b3864]">
                  {s.title}
                </span>
              </div>
            </Link>
          ))}
        </div>
        <p className="text-center text-sm text-[#607d8b] mt-6">
          Bố mẹ chọn truyện rồi đọc cho bé nghe nhé.
        </p>
      </div>
    </div>
  );
}
