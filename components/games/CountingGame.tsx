'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  GameObject,
  OBJECT_KEYS,
  OBJECT_NAMES_VI,
  type ObjectKey,
} from './objects';
import { playSound, speakVi, preloadSounds } from '@/lib/game-audio';
import { usePointerDrag, hitTestEl } from '@/lib/games/usePointerDrag';
import { useGameProgress } from '@/lib/games/useGameProgress';

const VI_NUM = [
  '', 'một', 'hai', 'ba', 'bốn', 'năm',
  'sáu', 'bảy', 'tám', 'chín', 'mười',
];

const ROWS_PER_PAGE = 4;
const GAME_ID = 'dem-so';

type Row = { id: number; kind: ObjectKey; count: number; matched: boolean };
type Token = { id: number; value: number; used: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sample = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n);

function buildPage(): { rows: Row[]; tokens: Token[] } {
  const counts = sample(
    Array.from({ length: 10 }, (_, i) => i + 1),
    ROWS_PER_PAGE,
  );
  const kinds = sample(OBJECT_KEYS, ROWS_PER_PAGE);
  const rows: Row[] = counts.map((count, i) => ({
    id: i,
    kind: kinds[i],
    count,
    matched: false,
  }));
  const tokens: Token[] = shuffle(counts).map((value, i) => ({
    id: i,
    value,
    used: false,
  }));
  return { rows, tokens };
}

export default function CountingGame() {
  const [{ rows, tokens }, setPage] = useState(buildPage);
  const [pageNo, setPageNo] = useState(1);
  const [wrongRow, setWrongRow] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { stars, ready, addStar } = useGameProgress();

  useEffect(() => {
    preloadSounds();
  }, []);

  const { drag, dragProps } = usePointerDrag<{ tokenId: number; value: number }>(
    (p, x, y) => {
      // Tìm thẻ gần điểm thả nhất (snap ~40px), tránh trùng thẻ kề nhau
      let hit: Row | null = null;
      let bestDist = Infinity;
      for (const r of rows) {
        const el = cardRefs.current.get(r.id);
        if (!hitTestEl(el, x, y, 40)) continue;
        const b = el!.getBoundingClientRect();
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          hit = r;
        }
      }
      if (!hit || hit.matched) return;

      if (hit.count === p.value) {
        const mr = hit;
        setPage((prev) => ({
          rows: prev.rows.map((r) =>
            r.id === mr.id ? { ...r, matched: true } : r,
          ),
          tokens: prev.tokens.map((t) =>
            t.id === p.tokenId ? { ...t, used: true } : t,
          ),
        }));
        playSound('correct');
        speakVi(`${VI_NUM[mr.count]} ${OBJECT_NAMES_VI[mr.kind]}`);
      } else {
        const wr = hit.id;
        setWrongRow(wr);
        playSound('wrong');
        speakVi('Chưa đúng, thử lại nhé');
        setTimeout(() => setWrongRow((c) => (c === wr ? null : c)), 600);
      }
    },
  );

  const allMatched = rows.every((r) => r.matched);

  useEffect(() => {
    if (allMatched && !celebrate) {
      setCelebrate(true);
      addStar(GAME_ID);
      playSound('win');
      speakVi('Giỏi quá! Bé làm đúng hết rồi!');
      const t = setTimeout(() => {
        setCelebrate(false);
        setPage(buildPage());
        setPageNo((n) => n + 1);
      }, 3200);
      return () => clearTimeout(t);
    }
  }, [allMatched, celebrate, addStar]);

  function newPage() {
    setCelebrate(false);
    setPage(buildPage());
    setPageNo((n) => n + 1);
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none touch-none"
      style={{
        background:
          'linear-gradient(160deg,#e3f2fd 0%,#fff3e0 50%,#f1f8e9 100%)',
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="text-2xl font-extrabold text-[#1b3864]">
          🔢 Đếm số{' '}
          <span className="text-base font-bold text-[#3b5788]">
            • Trang {pageNo}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/80 rounded-xl px-3 py-1.5 shadow">
            <span className="text-2xl">⭐</span>
            <span className="text-2xl font-extrabold text-[#f9a825]">
              {ready ? stars : '…'}
            </span>
          </div>
          <button
            type="button"
            onClick={newPage}
            className="px-4 py-2 rounded-xl bg-[#a3c947] text-[#1b3864] font-bold text-base shadow active:scale-95"
          >
            Trang mới
          </button>
          <Link
            href="/games"
            className="px-4 py-2 rounded-xl bg-white text-[#1b3864] font-bold text-base shadow border border-[#cdd9e5] active:scale-95"
          >
            Thoát
          </Link>
        </div>
      </div>

      {/* Sân chơi: SỐ bên trái — ĐỒ VẬT bên phải */}
      <div className="absolute inset-x-0 bottom-0 top-[60px] flex items-stretch gap-3 px-4 pb-4">
        {/* Cột trái: số kéo được */}
        <div className="w-[120px] sm:w-[150px] flex flex-col gap-3">
          {tokens.map((t) => (
            <div key={t.id} className="flex-1 flex items-center justify-center">
              {t.used ? (
                <div className="w-full h-full rounded-3xl border-4 border-dashed border-[#cfe0ec]" />
              ) : (
                <button
                  type="button"
                  {...dragProps({ tokenId: t.id, value: t.value })}
                  className={`w-full h-full rounded-3xl bg-[#42a5f5] border-4 border-[#1565c0] text-white font-extrabold shadow-lg active:scale-95 touch-none ${
                    drag?.payload.tokenId === t.id ? 'opacity-30' : ''
                  }`}
                  style={{ fontSize: 'clamp(2.5rem,7vh,4.5rem)' }}
                >
                  {t.value}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Cột phải: thẻ đồ vật (drop target) */}
        <div className="flex-1 flex flex-col gap-3">
          {rows.map((r) => {
            const objSize = r.count <= 4 ? 54 : r.count <= 7 ? 42 : 34;
            const isWrong = wrongRow === r.id;
            return (
              <div
                key={r.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(r.id, el);
                  else cardRefs.current.delete(r.id);
                }}
                className={`flex-1 rounded-3xl border-4 flex items-center px-4 transition-all ${
                  r.matched
                    ? 'bg-[#e8f5e9] border-[#66bb6a]'
                    : isWrong
                      ? 'bg-[#ffebee] border-[#ef5350] animate-[wiggle_0.3s_ease-in-out_2]'
                      : 'bg-white/80 border-[#cfe0ec]'
                }`}
              >
                {r.matched && (
                  <div className="flex items-center gap-2 pr-3">
                    <span className="text-5xl font-extrabold text-[#2e7d32]">
                      {r.count}
                    </span>
                    <span className="text-4xl">✅</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 items-center justify-center flex-1">
                  {Array.from({ length: r.count }, (_, i) => (
                    <span
                      key={i}
                      className="inline-block animate-[bob_2.4s_ease-in-out_infinite]"
                      style={{ animationDelay: `${(i % 5) * 0.18}s` }}
                    >
                      <GameObject kind={r.kind} size={objSize} />
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Số đang kéo */}
      {drag && (
        <div
          className="fixed z-50 pointer-events-none flex items-center justify-center rounded-3xl bg-[#1e88e5] border-4 border-[#0d47a1] text-white font-extrabold shadow-2xl"
          style={{
            width: 110,
            height: 110,
            left: drag.x - 55,
            top: drag.y - 55,
            fontSize: '3.5rem',
          }}
        >
          {drag.payload.value}
        </div>
      )}

      {/* Ăn mừng */}
      {celebrate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          {Array.from({ length: 36 }, (_, i) => (
            <span
              key={i}
              className="absolute text-3xl animate-[fall_3s_linear_forwards]"
              style={{
                left: `${(i * 2.8) % 100}%`,
                top: '-10%',
                animationDelay: `${(i % 9) * 0.12}s`,
              }}
            >
              {['🎉', '⭐', '🎈', '🌟', '🏆'][i % 5]}
            </span>
          ))}
          <div className="text-6xl font-extrabold text-[#e65100] bg-white/80 px-10 py-6 rounded-3xl shadow-2xl animate-[pop_0.5s_ease-out]">
            🎉 Giỏi quá! 🎉
          </div>
        </div>
      )}

      <style>{`
        @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes wiggle { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
        @keyframes fall { to { transform: translateY(115vh) rotate(360deg); } }
        @keyframes pop { 0%{transform:scale(0.3);opacity:0} 100%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}
