// Mở khoá audio cho cả phiên — gọi trong user gesture (tap đầu tiên).
// Browser mobile (đặc biệt iOS Safari) chặn auto-play âm thanh/giọng nói
// cho tới khi có user gesture. Hàm này phải được call SYNCHRONOUSLY từ
// handler của gesture (onClick/onPointerDown), không qua setTimeout.

import { primeAudio } from '@/lib/game-audio';

let _unlocked = false;

export function isAudioUnlocked() {
  return _unlocked;
}

export function unlockAudio() {
  if (_unlocked) return;
  _unlocked = true;
  // 1. Web Audio context (cho synth fallback)
  try {
    const W = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext || W.webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      // resume nếu đang suspended (Chrome)
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.01);
      setTimeout(() => ctx.close(), 200);
    }
  } catch {
    /* bỏ qua */
  }
  // 2. SpeechSynthesis — speak một utterance silent ngay trong gesture
  try {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'vi-VN';
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* bỏ qua */
  }
  // 3. HTMLAudioElement — play muted để iOS cho phép play sau này
  primeAudio();
}
