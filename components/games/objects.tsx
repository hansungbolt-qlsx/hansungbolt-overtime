// SVG đồ vật cho game đếm số — style sách thiếu nhi: bo tròn, màu tươi.
// Mỗi component nhận size (px). viewBox 0 0 100 100 để scale thoải mái.

type ObjProps = { size?: number };

export type ObjectKey =
  | 'ball'
  | 'flower'
  | 'fish'
  | 'bird'
  | 'apple'
  | 'star'
  | 'balloon'
  | 'butterfly';

function Ball({ size = 56 }: ObjProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="44" fill="#ff7043" stroke="#d84315" strokeWidth="3" />
      <path d="M50 6 A44 44 0 0 1 94 50 L50 50 Z" fill="#ffb74d" />
      <path d="M50 94 A44 44 0 0 1 6 50 L50 50 Z" fill="#ffa726" />
      <circle cx="50" cy="50" r="9" fill="#fff8e1" />
    </svg>
  );
}

function Flower({ size = 56 }: ObjProps) {
  const petals = [0, 60, 120, 180, 240, 300];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {petals.map((deg) => (
        <ellipse
          key={deg}
          cx="50"
          cy="26"
          rx="13"
          ry="20"
          fill="#ec407a"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="14" fill="#ffd54f" stroke="#f9a825" strokeWidth="2" />
    </svg>
  );
}

function Fish({ size = 56 }: ObjProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <polygon points="78,50 98,30 98,70" fill="#26c6da" />
      <ellipse cx="46" cy="50" rx="40" ry="26" fill="#29b6f6" stroke="#0277bd" strokeWidth="3" />
      <circle cx="26" cy="44" r="6" fill="#fff" />
      <circle cx="25" cy="44" r="3" fill="#01579b" />
      <path d="M50 38 q10 12 0 24" fill="none" stroke="#0277bd" strokeWidth="3" />
    </svg>
  );
}

function Bird({ size = 56 }: ObjProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <ellipse cx="48" cy="56" rx="34" ry="30" fill="#ab47bc" stroke="#6a1b9a" strokeWidth="3" />
      <circle cx="70" cy="38" r="20" fill="#ce93d8" />
      <polygon points="86,36 100,42 86,48" fill="#ffa000" />
      <circle cx="74" cy="34" r="4.5" fill="#311b92" />
      <path d="M30 56 q-20 8 -6 24 q14 -4 22 -14 Z" fill="#7b1fa2" />
    </svg>
  );
}

function Apple({ size = 56 }: ObjProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path
        d="M50 28 C30 12 8 28 12 52 C15 78 38 92 50 84 C62 92 85 78 88 52 C92 28 70 12 50 28 Z"
        fill="#ef5350"
        stroke="#c62828"
        strokeWidth="3"
      />
      <rect x="47" y="14" width="6" height="16" rx="3" fill="#6d4c41" />
      <path d="M53 20 q18 -10 24 4 q-16 8 -24 -4" fill="#66bb6a" />
      <ellipse cx="36" cy="44" rx="8" ry="12" fill="#ffcdd2" opacity="0.7" />
    </svg>
  );
}

function Star({ size = 56 }: ObjProps) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI / 2) * -1 + (i * 2 * Math.PI) / 5;
    const a2 = a + Math.PI / 5;
    pts.push(`${50 + 46 * Math.cos(a)},${50 + 46 * Math.sin(a)}`);
    pts.push(`${50 + 20 * Math.cos(a2)},${50 + 20 * Math.sin(a2)}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <polygon
        points={pts.join(' ')}
        fill="#ffca28"
        stroke="#f57f17"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Balloon({ size = 56 }: ObjProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 72 q-4 8 0 16" fill="none" stroke="#9e9e9e" strokeWidth="2" />
      <ellipse cx="50" cy="40" rx="30" ry="36" fill="#42a5f5" stroke="#1565c0" strokeWidth="3" />
      <polygon points="46,74 54,74 50,82" fill="#1565c0" />
      <ellipse cx="40" cy="28" rx="8" ry="12" fill="#bbdefb" opacity="0.8" />
    </svg>
  );
}

function Butterfly({ size = 56 }: ObjProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <ellipse cx="36" cy="34" rx="22" ry="18" fill="#ff7043" />
      <ellipse cx="64" cy="34" rx="22" ry="18" fill="#ff7043" />
      <ellipse cx="38" cy="64" rx="18" ry="16" fill="#ffa726" />
      <ellipse cx="62" cy="64" rx="18" ry="16" fill="#ffa726" />
      <rect x="47" y="26" width="6" height="50" rx="3" fill="#4e342e" />
      <circle cx="50" cy="24" r="6" fill="#4e342e" />
      <path d="M50 20 q-8 -12 -14 -14 M50 20 q8 -12 14 -14" stroke="#4e342e" strokeWidth="2" fill="none" />
    </svg>
  );
}

const MAP: Record<ObjectKey, (p: ObjProps) => React.ReactElement> = {
  ball: Ball,
  flower: Flower,
  fish: Fish,
  bird: Bird,
  apple: Apple,
  star: Star,
  balloon: Balloon,
  butterfly: Butterfly,
};

export const OBJECT_KEYS: ObjectKey[] = [
  'ball',
  'flower',
  'fish',
  'bird',
  'apple',
  'star',
  'balloon',
  'butterfly',
];

export const OBJECT_NAMES_VI: Record<ObjectKey, string> = {
  ball: 'quả bóng',
  flower: 'bông hoa',
  fish: 'con cá',
  bird: 'con chim',
  apple: 'quả táo',
  star: 'ngôi sao',
  balloon: 'bóng bay',
  butterfly: 'con bướm',
};

export function GameObject({ kind, size }: { kind: ObjectKey; size?: number }) {
  const Cmp = MAP[kind];
  return <Cmp size={size} />;
}
