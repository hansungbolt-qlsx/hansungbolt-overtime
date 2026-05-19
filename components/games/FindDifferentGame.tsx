'use client';

import { useEffect, useRef, useState } from 'react';
import { playSound, speakVi, preloadSounds } from '@/lib/game-audio';
import { useGameProgress } from '@/lib/games/useGameProgress';
import { OBJECT_KEYS, GameObject } from './objects';
import { sample, randInt, nextPraise } from '@/lib/games/vi';
import GameShell from './GameShell';
import Celebrate from './Celebrate';

const GAME_ID = 'tim-khac';

function buildRound() {
  const [mainKind, oddKind] = sample(OBJECT_KEYS, 2);
  const total = randInt(4, 6);
  const oddIndex = randInt(0, total - 1);
  const items = Array.from({ length: total }, (_, i) =>
    i === oddIndex ? oddKind : mainKind,
  );
  return { items, oddIndex, oddKind };
}

export default function FindDifferentGame() {
  const { stars, ready, addStar } = useGameProgress();
  const [round, setRound] = useState(buildRound);
  const [wrong, setWrong] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const lock = useRef(false);

  const prompt = 'Chạm vào hình KHÁC nhé';
  const speak = () => speakVi(prompt);

  useEffect(() => {
    preloadSounds();
  }, []);
  useEffect(() => {
    const t = setTimeout(speak, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function pick(i: number) {
    if (lock.current) return;
    if (i === round.oddIndex) {
      lock.current = true;
      playSound('correct');
      speakVi(nextPraise());
      addStar(GAME_ID);
      const ns = streak + 1;
      setStreak(ns);
      if (ns % 5 === 0) {
        setCelebrate(true);
        playSound('win');
      }
      setTimeout(
        () => {
          setCelebrate(false);
          setRound(buildRound());
          lock.current = false;
        },
        ns % 5 === 0 ? 2600 : 1100,
      );
    } else {
      setWrong(i);
      playSound('wrong');
      speakVi('Chưa đúng, thử lại nhé');
      setTimeout(() => setWrong((c) => (c === i ? null : c)), 600);
    }
  }

  const cols = round.items.length <= 4 ? 2 : 3;

  return (
    <>
      <GameShell
        title="🔍 Tìm cái khác"
        stars={stars}
        starsReady={ready}
        instruction={prompt}
        onSpeak={speak}
        onNewRound={() => {
          if (lock.current) return;
          setRound(buildRound());
        }}
      >
        <div
          className="flex-1 grid gap-4 sm:gap-6 place-items-stretch"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {round.items.map((kind, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              className={`rounded-3xl border-4 bg-white shadow-lg active:scale-95 transition-all flex items-center justify-center ${
                wrong === i
                  ? 'border-[#ef5350] bg-[#ffebee] animate-[wiggle_0.3s_ease-in-out_2]'
                  : 'border-[#cfe0ec]'
              }`}
            >
              <span className="animate-[bob_2.4s_ease-in-out_infinite]">
                <GameObject kind={kind} size={84} />
              </span>
            </button>
          ))}
        </div>
      </GameShell>
      <Celebrate show={celebrate} />
      <style>{`
        @keyframes wiggle { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
        @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
      `}</style>
    </>
  );
}
