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
  | 'boat'
  | 'mountain'
  | 'bamboo'
  | 'flower'
  | 'gold'
  | 'snake'
  | 'tiger'
  | 'buffalo'
  | 'turtle'
  | 'sword'
  | 'rabbit'
  | 'wolf'
  | 'pig'
  | 'goat'
  | 'sheep';

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

function Mountain() {
  return (
    <g>
      <polygon points="-42,0 0,-58 42,0" fill="#8d99a6" />
      <polygon points="-14,-38 0,-58 14,-38" fill="#eceff1" />
    </g>
  );
}
function Bamboo() {
  return (
    <g>
      <rect x="-4" y="-62" width="8" height="62" rx="3" fill="#7cb342" />
      {[-48, -32, -16].map((y, i) => (
        <line key={i} x1="-4" y1={y} x2="4" y2={y} stroke="#558b2f" strokeWidth="2" />
      ))}
      <ellipse cx="10" cy="-52" rx="10" ry="4" fill="#9ccc65" />
      <ellipse cx="-10" cy="-38" rx="10" ry="4" fill="#9ccc65" />
    </g>
  );
}
function Flower() {
  return (
    <g>
      <rect x="-2" y="-22" width="4" height="22" fill="#66bb6a" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
        <ellipse
          key={d}
          cx="0"
          cy="-34"
          rx="5"
          ry="9"
          fill="#fff"
          stroke="#e0e0e0"
          transform={`rotate(${d} 0 -22)`}
        />
      ))}
      <circle cx="0" cy="-22" r="6" fill="#ffca28" />
    </g>
  );
}
function Gold() {
  return (
    <g>
      {[
        [-12, -4],
        [0, -5],
        [12, -4],
        [-6, -12],
        [6, -12],
        [0, -19],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="6"
          fill="#ffd54f"
          stroke="#f9a825"
          strokeWidth="1.5"
        />
      ))}
    </g>
  );
}
function Snake() {
  return (
    <g>
      <path
        d="M-22 0 q8 -18 18 -9 q-10 7 0 15 q12 -5 14 -19"
        fill="none"
        stroke="#43a047"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="11" cy="-24" r="6" fill="#388e3c" />
      <circle cx="13" cy="-26" r="1.6" fill="#b71c1c" />
      <line x1="16" y1="-24" x2="24" y2="-24" stroke="#d50000" strokeWidth="2" />
    </g>
  );
}
function Tiger() {
  return (
    <g>
      <ellipse cx="0" cy="-12" rx="22" ry="13" fill="#ffa726" />
      <circle cx="-18" cy="-18" r="10" fill="#ffb74d" />
      <path d="M-6 -12 v18 M2 -12 v18 M10 -12 v15" stroke="#5d4037" strokeWidth="2" />
      <polygon points="-25,-26 -21,-21 -27,-21" fill="#ffa726" />
      <circle cx="-21" cy="-20" r="1.6" fill="#222" />
      <rect x="14" y="-7" width="11" height="4" rx="2" fill="#ffa726" />
    </g>
  );
}
function Buffalo() {
  return (
    <g>
      <ellipse cx="0" cy="-12" rx="22" ry="13" fill="#616161" />
      <circle cx="-18" cy="-15" r="9" fill="#757575" />
      <path
        d="M-27 -20 q-6 -9 3 -11 M-9 -20 q6 -9 -3 -11"
        stroke="#eceff1"
        strokeWidth="3"
        fill="none"
      />
      <circle cx="-21" cy="-15" r="1.5" fill="#111" />
      <rect x="-8" y="-2" width="4" height="6" fill="#424242" />
      <rect x="8" y="-2" width="4" height="6" fill="#424242" />
    </g>
  );
}
function Turtle() {
  return (
    <g>
      <ellipse cx="0" cy="-7" rx="20" ry="11" fill="#2e7d32" />
      <path d="M-20 -7 a20 11 0 0 1 40 0" fill="#43a047" />
      <circle cx="18" cy="-8" r="6" fill="#558b2f" />
      <circle cx="20" cy="-9" r="1.4" fill="#fff" />
      <rect x="-16" y="-1" width="5" height="6" rx="2" fill="#558b2f" />
      <rect x="11" y="-1" width="5" height="6" rx="2" fill="#558b2f" />
    </g>
  );
}
function Sword() {
  return (
    <g>
      <rect x="-2" y="-40" width="4" height="34" fill="#cfd8dc" stroke="#90a4ae" />
      <polygon points="-2,-40 2,-40 0,-47" fill="#eceff1" />
      <rect x="-9" y="-8" width="18" height="4" rx="2" fill="#6d4c41" />
      <rect x="-2" y="-4" width="4" height="10" rx="2" fill="#8d6e63" />
    </g>
  );
}

function Rabbit() {
  return (
    <g>
      <ellipse cx="0" cy="-10" rx="18" ry="12" fill="#eceff1" />
      <circle cx="-16" cy="-16" r="9" fill="#f5f5f5" />
      <ellipse cx="-19" cy="-30" rx="3.5" ry="10" fill="#eceff1" />
      <ellipse cx="-12" cy="-30" rx="3.5" ry="10" fill="#eceff1" />
      <ellipse cx="-19" cy="-30" rx="1.6" ry="6" fill="#f8bbd0" />
      <ellipse cx="-12" cy="-30" rx="1.6" ry="6" fill="#f8bbd0" />
      <circle cx="-19" cy="-17" r="1.5" fill="#37474f" />
      <circle cx="16" cy="-9" r="5" fill="#fff" />
      <rect x="-14" y="-1" width="4" height="6" rx="2" fill="#cfd8dc" />
      <rect x="6" y="-1" width="4" height="6" rx="2" fill="#cfd8dc" />
    </g>
  );
}
function Wolf() {
  return (
    <g>
      <ellipse cx="0" cy="-12" rx="22" ry="13" fill="#78909c" />
      <circle cx="-17" cy="-17" r="10" fill="#90a4ae" />
      <polygon points="-24,-28 -19,-20 -28,-21" fill="#607d8b" />
      <polygon points="-12,-28 -10,-20 -16,-21" fill="#607d8b" />
      <polygon points="-27,-15 -35,-13 -27,-10" fill="#90a4ae" />
      <circle cx="-20" cy="-19" r="1.6" fill="#b71c1c" />
      <polygon points="-31,-11 -29,-7 -33,-8" fill="#fff" />
      <polygon points="20,-14 31,-22 24,-9" fill="#607d8b" />
      <rect x="-12" y="-2" width="4" height="7" rx="2" fill="#607d8b" />
      <rect x="8" y="-2" width="4" height="7" rx="2" fill="#607d8b" />
    </g>
  );
}
function Pig() {
  return (
    <g>
      <ellipse cx="0" cy="-12" rx="21" ry="13" fill="#f8bbd0" />
      <circle cx="-16" cy="-15" r="10" fill="#f48fb1" />
      <ellipse cx="-25" cy="-15" rx="5" ry="4" fill="#ec407a" />
      <circle cx="-26" cy="-15" r="1" fill="#ad1457" />
      <circle cx="-24" cy="-15" r="1" fill="#ad1457" />
      <polygon points="-19,-24 -14,-21 -22,-21" fill="#f48fb1" />
      <circle cx="-19" cy="-17" r="1.4" fill="#4e342e" />
      <path d="M20 -14 q8 -2 6 4 q-2 4 -6 1" fill="none" stroke="#ec407a" strokeWidth="2.5" />
      <rect x="-12" y="-2" width="4" height="7" rx="2" fill="#f48fb1" />
      <rect x="8" y="-2" width="4" height="7" rx="2" fill="#f48fb1" />
    </g>
  );
}
function Goat() {
  return (
    <g>
      <ellipse cx="0" cy="-12" rx="20" ry="12" fill="#f5f5f5" />
      <circle cx="-16" cy="-15" r="9" fill="#fafafa" />
      <path d="M-20 -23 q-4 -8 1 -10 M-12 -23 q4 -8 -1 -10" stroke="#bdbdbd" strokeWidth="2.5" fill="none" />
      <circle cx="-19" cy="-15" r="1.5" fill="#37474f" />
      <path d="M-16 -7 q0 5 -3 8" stroke="#e0e0e0" strokeWidth="2" fill="none" />
      <rect x="-12" y="-1" width="3.5" height="7" rx="1.7" fill="#e0e0e0" />
      <rect x="8" y="-1" width="3.5" height="7" rx="1.7" fill="#e0e0e0" />
    </g>
  );
}
function Sheep() {
  return (
    <g>
      <ellipse cx="0" cy="-13" rx="22" ry="14" fill="#fff" />
      <ellipse cx="-12" cy="-23" rx="9" ry="8" fill="#fff" />
      <ellipse cx="10" cy="-23" rx="9" ry="8" fill="#fff" />
      <circle cx="-18" cy="-13" r="7" fill="#5d4037" />
      <ellipse cx="-23" cy="-16" rx="2.5" ry="3.5" fill="#5d4037" />
      <circle cx="-19" cy="-14" r="1.3" fill="#fff" />
      <rect x="-12" y="-1" width="4" height="7" rx="2" fill="#5d4037" />
      <rect x="8" y="-1" width="4" height="7" rx="2" fill="#5d4037" />
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
  mountain: Mountain,
  bamboo: Bamboo,
  flower: Flower,
  gold: Gold,
  snake: Snake,
  tiger: Tiger,
  buffalo: Buffalo,
  turtle: Turtle,
  sword: Sword,
  rabbit: Rabbit,
  wolf: Wolf,
  pig: Pig,
  goat: Goat,
  sheep: Sheep,
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
