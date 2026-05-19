'use client';

import { useEffect, useRef, useState } from 'react';
import { playSound, speakVi, preloadSounds } from '@/lib/game-audio';
import { useGameProgress } from '@/lib/games/useGameProgress';
import { randInt, nextPraise } from '@/lib/games/vi';
import GameShell from './GameShell';
import Celebrate from './Celebrate';

const GAME_ID = 'so-sanh-so';

function buildRound() {
  let a = randInt(1, 10);
  let b = randInt(1, 10);
  while (b === a) b = randInt(1, 10);
  const askBigger = Math.random() < 0.5;
  return { a, b, askBigger };
}

export default function CompareNumberGame() {
  const { stars, ready, addStar } = useGameProgress();
  const [round, setRound] = useState(buildRound);
  const [wrong, setWrong] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const lock = useRef(false);

  const prompt = round.askBigger ? 'Số nào LỚN hơn?' : 'Số nào BÉ hơn?';
  const speak = () => speakVi(prompt);

  useEffect(() => {
    preloadSounds();
  }, []);
  useEffect(() => {
    const t = setTimeout(speak, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function pick(n: number) {
    if (lock.current) return;
    const correct = round.askBigger
      ? Math.max(round.a, round.b)
      : Math.min(round.a, round.b);
    if (n === correct) {
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
      setWrong(n);
      playSound('wrong');
      speakVi('Chưa đúng, thử lại nhé');
      setTimeout(() => setWrong((c) => (c === n ? null : c)), 600);
    }
  }

  return (
    <>
      <GameShell
        title="📊 Số lớn / Số bé"
        stars={stars}
        starsReady={ready}
        instruction={prompt}
        onSpeak={speak}
        onNewRound={() => {
          if (lock.current) return;
          setRound(buildRound());
        }}
      >
        <div className="flex-1 flex gap-4 sm:gap-6">
          {[round.a, round.b].map((n, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => pick(n)}
              className={`flex-1 rounded-3xl border-4 font-extrabold shadow-lg active:scale-95 transition-all ${
                wrong === n
                  ? 'bg-[#ffebee] border-[#ef5350] animate-[wiggle_0.3s_ease-in-out_2]'
                  : 'bg-white border-[#42a5f5] text-[#1565c0]'
              }`}
              style={{ fontSize: 'clamp(4rem,28vh,14rem)' }}
            >
              {n}
            </button>
          ))}
        </div>
      </GameShell>
      <Celebrate show={celebrate} />
      <style>{`
        @keyframes wiggle { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
      `}</style>
    </>
  );
}
