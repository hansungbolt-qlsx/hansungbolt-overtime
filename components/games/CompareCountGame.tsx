'use client';

import { useEffect, useRef, useState } from 'react';
import { playSound, speakVi, preloadSounds } from '@/lib/game-audio';
import { useGameProgress } from '@/lib/games/useGameProgress';
import { OBJECT_KEYS, type ObjectKey } from './objects';
import { GameObject } from './objects';
import { sample, randInt, nextPraise } from '@/lib/games/vi';
import GameShell from './GameShell';
import Celebrate from './Celebrate';

const GAME_ID = 'nhieu-it';

type Side = { kind: ObjectKey; count: number };
function buildRound() {
  let a = randInt(1, 9);
  let b = randInt(1, 9);
  while (b === a) b = randInt(1, 9);
  const [k1, k2] = sample(OBJECT_KEYS, 2);
  const left: Side = { kind: k1, count: a };
  const right: Side = { kind: k2, count: b };
  const askMore = Math.random() < 0.5; // true = nhiều hơn
  return { left, right, askMore };
}

export default function CompareCountGame() {
  const { stars, ready, addStar } = useGameProgress();
  const [round, setRound] = useState(buildRound);
  const [wrong, setWrong] = useState<'left' | 'right' | null>(null);
  const [streak, setStreak] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const lock = useRef(false);

  const prompt = round.askMore ? 'Rổ nào NHIỀU hơn?' : 'Rổ nào ÍT hơn?';
  const speak = () => speakVi(prompt);

  useEffect(() => {
    preloadSounds();
  }, []);
  useEffect(() => {
    const t = setTimeout(speak, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function pick(side: 'left' | 'right') {
    if (lock.current) return;
    const moreSide =
      round.left.count > round.right.count ? 'left' : 'right';
    const correctSide = round.askMore
      ? moreSide
      : moreSide === 'left'
        ? 'right'
        : 'left';
    if (side === correctSide) {
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
      setWrong(side);
      playSound('wrong');
      speakVi('Chưa đúng, thử lại nhé');
      setTimeout(() => setWrong((c) => (c === side ? null : c)), 600);
    }
  }

  const Basket = ({ side, data }: { side: 'left' | 'right'; data: Side }) => {
    const objSize = data.count <= 4 ? 50 : data.count <= 7 ? 40 : 32;
    return (
      <button
        type="button"
        onClick={() => pick(side)}
        className={`flex-1 rounded-3xl border-4 p-3 shadow-lg active:scale-95 transition-all flex flex-wrap gap-2 items-center justify-center ${
          wrong === side
            ? 'bg-[#ffebee] border-[#ef5350] animate-[wiggle_0.3s_ease-in-out_2]'
            : 'bg-white border-[#cfe0ec]'
        }`}
      >
        {Array.from({ length: data.count }, (_, i) => (
          <span
            key={i}
            className="inline-block animate-[bob_2.4s_ease-in-out_infinite]"
            style={{ animationDelay: `${(i % 5) * 0.18}s` }}
          >
            <GameObject kind={data.kind} size={objSize} />
          </span>
        ))}
      </button>
    );
  };

  return (
    <>
      <GameShell
        title="⚖️ Nhiều hơn / Ít hơn"
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
          <Basket side="left" data={round.left} />
          <Basket side="right" data={round.right} />
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
