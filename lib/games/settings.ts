// Cài đặt cho bố mẹ: bật/tắt giọng đọc, âm lượng. Lưu localStorage
// (đây là tuỳ chọn thiết bị, không phải tiến độ → không cần Supabase).

export type GameSettings = { tts: boolean; volume: number }; // volume 0..1

const KEY = 'beHoc.settings';
const DEFAULT: GameSettings = { tts: true, volume: 0.8 };

let cache: GameSettings | null = null;

export function getSettings(): GameSettings {
  if (cache) return cache;
  if (typeof window === 'undefined') return DEFAULT;
  let s: GameSettings;
  try {
    const raw = localStorage.getItem(KEY);
    s = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    s = { ...DEFAULT };
  }
  cache = s;
  return s;
}

export function setSettings(patch: Partial<GameSettings>) {
  const next = { ...getSettings(), ...patch };
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
