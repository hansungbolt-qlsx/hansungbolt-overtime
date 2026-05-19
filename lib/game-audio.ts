// Âm thanh game: ưu tiên file mp3 trong /public/sounds, fallback Web Audio
// tổng hợp nếu file chưa có / lỗi (đảm bảo game luôn có tiếng).

type Kind = 'correct' | 'wrong' | 'win';

const FILES: Record<Kind, string> = {
  correct: '/sounds/clap.wav',
  wrong: '/sounds/oops.wav',
  win: '/sounds/win.wav',
};

const cache: Partial<Record<Kind, HTMLAudioElement>> = {};
let fileBroken: Partial<Record<Kind, boolean>> = {};

function synth(kind: Kind) {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    const now = ctx.currentTime;
    const beep = (freq: number, start: number, dur: number, vol = 0.25) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(vol, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(now + start);
      o.stop(now + start + dur);
    };
    if (kind === 'correct') {
      beep(660, 0, 0.15);
      beep(880, 0.12, 0.2);
    } else if (kind === 'wrong') {
      beep(200, 0, 0.25, 0.2);
    } else {
      [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.12, 0.3));
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* im lặng nếu không hỗ trợ */
  }
}

export function playSound(kind: Kind) {
  if (typeof window === 'undefined') return;
  if (fileBroken[kind]) {
    synth(kind);
    return;
  }
  try {
    let a = cache[kind];
    if (!a) {
      a = new Audio(FILES[kind]);
      a.preload = 'auto';
      cache[kind] = a;
    }
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        fileBroken[kind] = true;
        synth(kind);
      });
    }
  } catch {
    fileBroken[kind] = true;
    synth(kind);
  }
}

// Đọc tiếng Việt qua Web Speech API (vi-VN). Nếu không có voice → bỏ qua.
export function speakVi(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    u.rate = 0.85;
    u.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const vi = voices.find((v) => v.lang?.toLowerCase().startsWith('vi'));
    if (vi) u.voice = vi;
    window.speechSynthesis.speak(u);
  } catch {
    /* bỏ qua nếu lỗi */
  }
}

export function preloadSounds() {
  if (typeof window === 'undefined') return;
  (Object.keys(FILES) as Kind[]).forEach((k) => {
    if (!cache[k]) {
      const a = new Audio(FILES[k]);
      a.preload = 'auto';
      cache[k] = a;
    }
  });
  // Kích hoạt voice list (Chrome load async)
  if (window.speechSynthesis) window.speechSynthesis.getVoices();
}
