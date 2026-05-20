import type { ReactNode } from 'react';
import AudioUnlockGate from '@/components/games/AudioUnlockGate';

// Wrap mọi route /games/* bằng AudioUnlockGate — hiện 1 lần/phiên
// để mở khoá audio (browser chặn auto-play tới khi có user gesture).
export default function GamesLayout({ children }: { children: ReactNode }) {
  return <AudioUnlockGate>{children}</AudioUnlockGate>;
}
