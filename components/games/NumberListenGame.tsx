'use client';

import { useEffect, useRef, useState } from 'react';
import { playSound, speakVi, preloadSounds } from '@/lib/game-audio';
import { useGameProgress } from '@/lib/games/useGameProgress';
import { VI_NUM, sample, randInt, nextPraise } from '@/lib/games/vi';
import GameShell from './GameShell';
import Celebrate from './Celebrate';

const GAME_ID = 'nghe-so';

function buildRound() {
  const target = randInt(1, 10);
  const distractors = sample(
    Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => n !== target),
    3,
  );
  return { target, choices: sample([target, ...distractors], 4) };
}

export default function NumberListenGame() {
  const { stars, ready, addStar } = useGameProgress();
  const [round, setRound] = useState(buildRound);
  const [wrong, setWrong] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const lock = useRef(false);

  const speak = () => speakVi(`Số ${VI_NUM[round.target]}`);

  useEffect(() => {
    preloadSounds();
  }, []);
  // Đọc đề mỗi lượt mới (sau cử chỉ chạm — tablet thường cho phép)
  useEffect(() => {
    const t = setTimeout(speak, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function pick(n: number) {
    if (lock.current) return;
    if (n === round.target) {
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
        title="👂 Nghe & chọn số"
        stars={stars}
        starsReady={ready}
        instruction="Nghe rồi chạm vào số đúng"
        onSpeak={speak}
        onNewRound={() => {
          if (lock.current) return;
          setRound(buildRound());
        }}
      >
        <div className="flex-1 grid grid-cols-2 gap-4 sm:gap-6 place-items-stretch">
          {round.choices.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              className={`rounded-3xl border-4 font-extrabold shadow-lg active:scale-95 transition-all ${
                wrong === n
                  ? 'bg-[#ffebee] border-[#ef5350] animate-[wiggle_0.3s_ease-in-out_2]'
                  : 'bg-white border-[#42a5f5] text-[#1565c0]'
              }`}
              style={{ fontSize: 'clamp(3rem,16vh,8rem)' }}
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
