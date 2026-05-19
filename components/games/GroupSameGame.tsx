'use client';

import { useEffect, useRef, useState } from 'react';
import { playSound, speakVi, preloadSounds } from '@/lib/game-audio';
import { useGameProgress } from '@/lib/games/useGameProgress';
import { OBJECT_KEYS, type ObjectKey, GameObject } from './objects';
import { sample, shuffle } from '@/lib/games/vi';
import { usePointerDrag, hitTestEl } from '@/lib/games/usePointerDrag';
import GameShell from './GameShell';
import Celebrate from './Celebrate';

const GAME_ID = 'gom-giong';
const PER_KIND = 3;

type Item = { id: number; kind: ObjectKey; sorted: boolean };

function buildRound() {
  const [kA, kB] = sample(OBJECT_KEYS, 2);
  const items: Item[] = [];
  let id = 0;
  for (let i = 0; i < PER_KIND; i++) {
    items.push({ id: id++, kind: kA, sorted: false });
    items.push({ id: id++, kind: kB, sorted: false });
  }
  return { kinds: [kA, kB] as ObjectKey[], items: shuffle(items) };
}

export default function GroupSameGame() {
  const { stars, ready, addStar } = useGameProgress();
  const [{ kinds, items }, setRound] = useState(buildRound);
  const [wrongKind, setWrongKind] = useState<ObjectKey | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const basketRefs = useRef<Map<ObjectKey, HTMLDivElement>>(new Map());
  const lock = useRef(false);

  const prompt = 'Kéo hình giống nhau vào chung một rổ';
  const speak = () => speakVi(prompt);

  useEffect(() => {
    preloadSounds();
  }, []);
  useEffect(() => {
    const t = setTimeout(speak, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kinds]);

  const { drag, dragProps } = usePointerDrag<{ id: number; kind: ObjectKey }>(
    (p, x, y) => {
      if (lock.current) return;
      let target: ObjectKey | null = null;
      for (const k of kinds) {
        if (hitTestEl(basketRefs.current.get(k), x, y, 40)) {
          target = k;
          break;
        }
      }
      if (!target) return;

      if (target === p.kind) {
        playSound('correct');
        setRound((prev) => {
          const nextItems = prev.items.map((it) =>
            it.id === p.id ? { ...it, sorted: true } : it,
          );
          const done = nextItems.every((it) => it.sorted);
          if (done) {
            lock.current = true;
            addStar(GAME_ID);
            setCelebrate(true);
            playSound('win');
            speakVi('Giỏi quá! Bé phân loại đúng hết rồi!');
            setTimeout(() => {
              setCelebrate(false);
              setRound(buildRound());
              lock.current = false;
            }, 2800);
          }
          // Kéo đúng từng món: chỉ tiếng vỗ tay, không nói (đỡ rườm)
          return { ...prev, items: nextItems };
        });
      } else {
        const wk = target;
        setWrongKind(wk);
        playSound('wrong');
        speakVi('Chưa đúng, thử lại nhé');
        setTimeout(() => setWrongKind((c) => (c === wk ? null : c)), 600);
      }
    },
  );

  const remaining = items.filter((it) => !it.sorted);

  return (
    <>
      <GameShell
        title="🧩 Gom nhóm giống"
        stars={stars}
        starsReady={ready}
        instruction={prompt}
        onSpeak={speak}
        onNewRound={() => {
          if (lock.current) return;
          setRound(buildRound());
        }}
      >
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Khu vực hình lộn xộn — kéo được */}
          <div className="flex-1 min-h-0 rounded-3xl bg-white/60 border-4 border-dashed border-[#cfe0ec] flex flex-wrap gap-3 items-center justify-center p-3 overflow-auto">
            {remaining.length === 0 ? (
              <span className="text-4xl">🎉</span>
            ) : (
              remaining.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  {...dragProps({ id: it.id, kind: it.kind })}
                  className={`active:scale-95 touch-none ${
                    drag?.payload.id === it.id ? 'opacity-30' : ''
                  }`}
                >
                  <GameObject kind={it.kind} size={72} />
                </button>
              ))
            )}
          </div>

          {/* 2 rổ phân loại */}
          <div className="shrink-0 flex gap-3 h-[34%]">
            {kinds.map((k) => {
              const inBasket = items.filter(
                (it) => it.sorted && it.kind === k,
              );
              return (
                <div
                  key={k}
                  ref={(el) => {
                    if (el) basketRefs.current.set(k, el);
                    else basketRefs.current.delete(k);
                  }}
                  className={`flex-1 rounded-3xl border-4 flex flex-col items-center justify-center gap-1 p-2 transition-all ${
                    wrongKind === k
                      ? 'bg-[#ffebee] border-[#ef5350] animate-[wiggle_0.3s_ease-in-out_2]'
                      : 'bg-[#e8f5e9] border-[#66bb6a]'
                  }`}
                >
                  <div className="opacity-50">
                    <GameObject kind={k} size={40} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center justify-center">
                    {inBasket.map((it) => (
                      <GameObject key={it.id} kind={it.kind} size={40} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </GameShell>

      {drag && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: drag.x - 36, top: drag.y - 36 }}
        >
          <GameObject kind={drag.payload.kind} size={72} />
        </div>
      )}

      <Celebrate show={celebrate} />
      <style>{`
        @keyframes wiggle { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
      `}</style>
    </>
  );
}
