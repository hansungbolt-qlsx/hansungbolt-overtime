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

const VI_NUM = [
  '',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
  'mười',
];

const ROWS_PER_PAGE = 4;

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

function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

function buildPage(): { rows: Row[]; tokens: Token[] } {
  // 4 số khác nhau trong 1-10
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
  const [drag, setDrag] = useState<{
    tokenId: number;
    value: number;
    x: number;
    y: number;
  } | null>(null);
  const [wrongRow, setWrongRow] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    preloadSounds();
  }, []);

  const allMatched = rows.every((r) => r.matched);

  useEffect(() => {
    if (allMatched && !celebrate) {
      setCelebrate(true);
      playSound('win');
      speakVi('Giỏi quá! Bé làm đúng hết rồi!');
      const t = setTimeout(() => {
        setCelebrate(false);
        setPage(buildPage());
        setPageNo((n) => n + 1);
      }, 3200);
      return () => clearTimeout(t);
    }
  }, [allMatched, celebrate]);

  function newPage() {
    setCelebrate(false);
    setPage(buildPage());
    setPageNo((n) => n + 1);
  }

  function onPointerDown(e: React.PointerEvent, token: Token) {
    if (token.used) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ tokenId: token.id, value: token.value, x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const px = e.clientX;
    const py = e.clientY;
    const d = drag;
    setDrag(null);

    // Hit-test: tìm card chứa điểm thả
    let hitRow: Row | null = null;
    for (const r of rows) {
      const el = cardRefs.current.get(r.id);
      if (!el) continue;
      const b = el.getBoundingClientRect();
      if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) {
        hitRow = r;
        break;
      }
    }
    if (!hitRow) return; // thả ra ngoài → không phạt, token về chỗ cũ

    if (hitRow.matched) return;

    if (hitRow.count === d.value) {
      const matchedRow = hitRow;
      setPage((prev) => ({
        rows: prev.rows.map((r) =>
          r.id === matchedRow.id ? { ...r, matched: true } : r,
        ),
        tokens: prev.tokens.map((t) =>
          t.id === d.tokenId ? { ...t, used: true } : t,
        ),
      }));
      playSound('correct');
      speakVi(`${VI_NUM[matchedRow.count]} ${OBJECT_NAMES_VI[matchedRow.kind]}`);
    } else {
      const wr = hitRow.id;
      setWrongRow(wr);
      playSound('wrong');
      speakVi('Chưa đúng, thử lại nhé');
      setTimeout(() => setWrongRow((cur) => (cur === wr ? null : cur)), 600);
    }
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
          🎈 Bé học đếm số{' '}
          <span className="text-base font-bold text-[#3b5788]">
            • Trang {pageNo}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={newPage}
            className="px-4 py-2 rounded-xl bg-[#a3c947] text-[#1b3864] font-bold text-base shadow active:scale-95"
          >
            Trang mới
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-white text-[#1b3864] font-bold text-base shadow border border-[#cdd9e5] active:scale-95"
          >
            Thoát
          </Link>
        </div>
      </div>

      {/* Sân chơi */}
      <div className="absolute inset-x-0 bottom-0 top-[60px] flex items-stretch gap-3 px-4 pb-4">
        {/* Cột trái: thẻ đồ vật */}
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
                {r.matched && (
                  <div className="flex items-center gap-2 pl-3">
                    <span className="text-5xl font-extrabold text-[#2e7d32]">
                      {r.count}
                    </span>
                    <span className="text-4xl">✅</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Cột phải: số kéo được */}
        <div className="w-[120px] sm:w-[150px] flex flex-col gap-3">
          {tokens.map((t) => (
            <div key={t.id} className="flex-1 flex items-center justify-center">
              {t.used ? (
                <div className="w-full h-full rounded-3xl border-4 border-dashed border-[#cfe0ec]" />
              ) : (
                <button
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, t)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className={`w-full h-full rounded-3xl bg-[#42a5f5] border-4 border-[#1565c0] text-white font-extrabold shadow-lg active:scale-95 touch-none ${
                    drag?.tokenId === t.id ? 'opacity-30' : ''
                  }`}
                  style={{ fontSize: 'clamp(2.5rem,7vh,4.5rem)' }}
                >
                  {t.value}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Số đang kéo (bay theo ngón tay) */}
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
          {drag.value}
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
