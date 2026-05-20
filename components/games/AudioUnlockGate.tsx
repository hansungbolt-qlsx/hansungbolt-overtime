'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isAudioUnlocked, unlockAudio } from '@/lib/games/audio-unlock';

// Lớp overlay "Chạm để bắt đầu" — xuất hiện 1 lần/phiên khi vào module
// Bé Học, để mở khoá âm thanh + giọng đọc cho cả tab. Sau khi tap,
// các điều hướng giữa các game không hiện lại (audio đã unlock).
export default function AudioUnlockGate({ children }: { children: ReactNode }) {
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    // Sau hydration: nếu audio chưa được mở khoá, hiện gate.
    if (!isAudioUnlocked()) setShowGate(true);
  }, []);

  function handleTap() {
    unlockAudio();
    setShowGate(false);
  }

  return (
    <>
      {children}
      {showGate && (
        <button
          type="button"
          onClick={handleTap}
          onPointerDown={handleTap}
          aria-label="Chạm để bắt đầu"
          className="fixed inset-0 z-[60] flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <div className="bg-white rounded-3xl px-10 py-8 text-center shadow-2xl max-w-md mx-4 pointer-events-none">
            <div className="text-7xl mb-3">🔊</div>
            <h2 className="text-2xl font-extrabold text-[#1b3864] mb-2">
              Chạm để bắt đầu
            </h2>
            <p className="text-sm text-[#3b5788]">
              Bố mẹ chạm 1 cái lên màn hình để bé nghe được giọng nói và âm thanh trong game.
            </p>
          </div>
        </button>
      )}
    </>
  );
}
