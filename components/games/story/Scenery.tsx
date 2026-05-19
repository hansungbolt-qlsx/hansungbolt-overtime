'use client';

// Bộ mảnh SVG dùng lại để ghép cảnh truyện — style phẳng bo tròn,
// kiểu sách thiếu nhi. Cảnh = nền + danh sách mảnh đặt theo toạ độ.
// viewBox cảnh: 0 0 200 120 (ngang ~5:3). Mảnh nhân vật/cây neo đáy.

import { useState } from 'react';

export type Bg = 'day' | 'night' | 'forest' | 'indoor' | 'river' | 'island';

export type PrimKey =
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'tree'
  | 'hill'
  | 'house'
  | 'bundle'
  | 'pot'
  | 'oldMan'
  | 'oldWoman'
  | 'boy'
  | 'girl'
  | 'man'
  | 'woman'
  | 'bird'
  | 'fishJump'
  | 'watermelon'
  | 'boat';

export type Placed = {
  k: PrimKey;
  x: number; // 0..200
  y: number; // 0..120 (đáy mảnh đặt tại y)
  s?: number; // scale, mặc định 1
  tap?: 'bounce' | 'wobble' | 'spin';
};

export type SceneSpec = { bg: Bg; items: Placed[] };

// ---- Nền ----
function Background({ bg }: { bg: Bg }) {
  const skies: Record<Bg, [string, string]> = {
    day: ['#bbeaff', '#e8f7ff'],
    night: ['#1a237e', '#3949ab'],
    forest: ['#c8e6c9', '#e8f5e9'],
    indoor: ['#ffe0b2', '#fff3e0'],
    river: ['#b3e5fc', '#e1f5fe'],
    island: ['#bbeaff', '#e0f7fa'],
  };
  const [c1, c2] = skies[bg];
  const ground =
    bg === 'night' ? '#2e7d32' : bg === 'indoor' ? '#a1887f' : '#8bc34a';
  return (
    <>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="200" height="120" fill="url(#sky)" />
      {bg === 'river' ? (
        <>
          <rect x="0" y="92" width="200" height="28" fill="#4fc3f7" />
          <rect x="0" y="92" width="200" height="4" fill="#81d4fa" />
        </>
      ) : bg === 'island' ? (
        <>
          <rect x="0" y="96" width="200" height="24" fill="#4fc3f7" />
          <ellipse cx="100" cy="100" rx="62" ry="16" fill="#ffe082" />
        </>
      ) : (
        <rect x="0" y="96" width="200" height="24" fill={ground} />
      )}
    </>
  );
}

// ---- Mảnh (vẽ quanh gốc, neo đáy ~ y=0 hướng lên âm) ----
function Sun() {
  return (
    <g>
      <circle cx="0" cy="0" r="14" fill="#ffd54f" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={Math.cos(a) * 16}
            y1={Math.sin(a) * 16}
            x2={Math.cos(a) * 22}
            y2={Math.sin(a) * 22}
            stroke="#ffca28"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}
function Moon() {
  return (
    <g>
      <circle cx="0" cy="0" r="12" fill="#fff9c4" />
      <circle cx="5" cy="-3" r="11" fill="#3949ab" />
    </g>
  );
}
function Cloud() {
  return (
    <g fill="#fff">
      <ellipse cx="-10" cy="0" rx="12" ry="9" />
      <ellipse cx="3" cy="-4" rx="14" ry="11" />
      <ellipse cx="14" cy="0" rx="11" ry="8" />
    </g>
  );
}
function Tree() {
  return (
    <g>
      <rect x="-4" y="-22" width="8" height="24" rx="3" fill="#8d6e63" />
      <circle cx="0" cy="-34" r="20" fill="#66bb6a" />
      <circle cx="-14" cy="-26" r="13" fill="#81c784" />
      <circle cx="14" cy="-26" r="13" fill="#81c784" />
    </g>
  );
}
function Hill() {
  return <ellipse cx="0" cy="6" rx="60" ry="26" fill="#9ccc65" />;
}
function House() {
  return (
    <g>
      <rect x="-22" y="-30" width="44" height="30" fill="#ffcc80" stroke="#e65100" strokeWidth="2" />
      <polygon points="-28,-30 0,-52 28,-30" fill="#bf360c" />
      <rect x="-7" y="-18" width="14" height="18" fill="#6d4c41" />
      <rect x="10" y="-24" width="9" height="9" fill="#90caf9" stroke="#1565c0" />
    </g>
  );
}
function Bundle() {
  return (
    <g>
      {[-6, -2, 2, 6].map((dx, i) => (
        <rect key={i} x={dx} y="-26" width="3" height="26" rx="1.5" fill="#a1887f" />
      ))}
      <rect x="-9" y="-16" width="20" height="4" rx="2" fill="#d84315" />
    </g>
  );
}
function Pot() {
  return (
    <g>
      <ellipse cx="0" cy="-2" rx="16" ry="6" fill="#5d4037" />
      <path d="M-15 -3 Q-18 -22 0 -24 Q18 -22 15 -3 Z" fill="#795548" />
      <ellipse cx="0" cy="-23" rx="13" ry="4" fill="#4e342e" />
    </g>
  );
}
function person(
  skin: string,
  cloth: string,
  hair: string,
  small = false,
) {
  const h = small ? 0.78 : 1;
  return (
    <g transform={`scale(${h})`}>
      <path d="M-10 0 L-8 -22 L8 -22 L10 0 Z" fill={cloth} />
      <circle cx="0" cy="-30" r="9" fill={skin} />
      <path d="M-9 -33 Q0 -44 9 -33 L9 -30 Q0 -36 -9 -30 Z" fill={hair} />
      <rect x="-13" y="-20" width="4" height="14" rx="2" fill={cloth} />
      <rect x="9" y="-20" width="4" height="14" rx="2" fill={cloth} />
      <circle cx="-3" cy="-30" r="1.3" fill="#222" />
      <circle cx="3" cy="-30" r="1.3" fill="#222" />
      <path d="M-3 -26 Q0 -24 3 -26" stroke="#222" strokeWidth="1" fill="none" />
    </g>
  );
}
const OldMan = () => person('#ffe0b2', '#90a4ae', '#eceff1');
const OldWoman = () => person('#ffe0b2', '#b39ddb', '#eceff1', true);
const Man = () => person('#ffcc80', '#42a5f5', '#4e342e');
const Woman = () => person('#ffcc80', '#ec407a', '#3e2723', true);
const Boy = () => person('#ffe0b2', '#26a69a', '#3e2723', true);
const Girl = () => person('#ffe0b2', '#ffb300', '#3e2723', true);
function Bird() {
  return (
    <g>
      <ellipse cx="0" cy="-6" rx="11" ry="9" fill="#7e57c2" />
      <circle cx="8" cy="-12" r="6" fill="#9575cd" />
      <polygon points="13,-12 20,-10 13,-8" fill="#ffa000" />
      <circle cx="9" cy="-13" r="1.4" fill="#fff" />
      <path d="M-4 -6 q-10 4 -2 10 q6 -2 8 -7Z" fill="#5e35b1" />
    </g>
  );
}
function FishJump() {
  return (
    <g>
      <ellipse cx="0" cy="-6" rx="12" ry="7" fill="#29b6f6" />
      <polygon points="10,-6 18,-12 18,0" fill="#0288d1" />
      <circle cx="-6" cy="-7" r="2" fill="#fff" />
      <circle cx="-6" cy="-7" r="1" fill="#01579b" />
    </g>
  );
}
function Watermelon() {
  return (
    <g>
      <circle cx="0" cy="-12" r="14" fill="#388e3c" />
      <path d="M-14 -12 a14 14 0 0 1 28 0" fill="#66bb6a" />
      <path d="M0 -26 v28 M-10 -22 v22 M10 -22 v22" stroke="#1b5e20" strokeWidth="2" />
    </g>
  );
}
function Boat() {
  return (
    <g>
      <path d="M-22 0 L22 0 L16 12 L-16 12 Z" fill="#8d6e63" />
      <rect x="-1" y="-26" width="3" height="26" fill="#6d4c41" />
      <polygon points="2,-24 2,-6 20,-10" fill="#fff8e1" />
    </g>
  );
}

const PRIM: Record<PrimKey, () => React.ReactElement> = {
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  tree: Tree,
  hill: Hill,
  house: House,
  bundle: Bundle,
  pot: Pot,
  oldMan: OldMan,
  oldWoman: OldWoman,
  boy: Boy,
  girl: Girl,
  man: Man,
  woman: Woman,
  bird: Bird,
  fishJump: FishJump,
  watermelon: Watermelon,
  boat: Boat,
};

function TapItem({ p }: { p: Placed }) {
  const [anim, setAnim] = useState(false);
  const Cmp = PRIM[p.k];
  // Lớp ngoài giữ vị trí (SVG attr) — lớp trong nhận animation CSS để
  // không xung đột (CSS transform sẽ đè transform attribute).
  return (
    <g
      transform={`translate(${p.x} ${p.y}) scale(${p.s ?? 1})`}
      style={{ cursor: p.tap ? 'pointer' : 'default' }}
      onClick={() => {
        if (!p.tap) return;
        setAnim(false);
        requestAnimationFrame(() => setAnim(true));
        setTimeout(() => setAnim(false), 800);
      }}
    >
      <g className={anim && p.tap ? `sc-${p.tap}` : ''}>
        <Cmp />
      </g>
    </g>
  );
}

export default function Scenery({ scene }: { scene: SceneSpec }) {
  return (
    <svg
      viewBox="0 0 200 120"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <Background bg={scene.bg} />
      {scene.items.map((p, i) => (
        <TapItem key={i} p={p} />
      ))}
      <style>{`
        .sc-bounce,.sc-wobble,.sc-spin{transform-box:fill-box;transform-origin:center}
        .sc-bounce{animation:scB .8s ease}
        .sc-wobble{animation:scW .8s ease}
        .sc-spin{animation:scS .8s ease}
        @keyframes scB{0%,100%{transform:translateY(0)}30%{transform:translateY(-12px)}60%{transform:translateY(-3px)}}
        @keyframes scW{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg)}75%{transform:rotate(9deg)}}
        @keyframes scS{to{transform:rotate(360deg)}}
      `}</style>
    </svg>
  );
}
