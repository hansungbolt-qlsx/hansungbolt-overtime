'use client';

import { useState } from 'react';
import { getSettings, setSettings } from '@/lib/games/settings';

export default function SettingsButton({
  onResetStars,
}: {
  onResetStars: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tts, setTts] = useState(true);
  const [vol, setVol] = useState(0.8);

  function openModal() {
    const s = getSettings();
    setTts(s.tts);
    setVol(s.volume);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label="Cài đặt"
        className="text-2xl bg-white/80 rounded-2xl w-12 h-12 flex items-center justify-center shadow active:scale-90"
      >
        ⚙️
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-extrabold text-[#1b3864] mb-4">
              ⚙️ Cài đặt (cho bố mẹ)
            </h2>

            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="font-semibold text-[#1b3864]">
                Giọng đọc tiếng Việt
              </span>
              <button
                type="button"
                onClick={() => {
                  const n = !tts;
                  setTts(n);
                  setSettings({ tts: n });
                }}
                className={`w-14 h-8 rounded-full transition relative ${
                  tts ? 'bg-[#66bb6a]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${
                    tts ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="py-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-[#1b3864]">Âm lượng</span>
                <span className="text-sm text-[#3b5788]">
                  {Math.round(vol * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(vol * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  setVol(v);
                  setSettings({ volume: v });
                }}
                className="w-full"
              />
            </div>

            <div className="py-3 border-b border-gray-100">
              <p className="text-xs text-[#607d8b] leading-relaxed">
                <strong>Trên máy tính bảng Android</strong>: nên dùng Chrome.
                Nếu không nghe được giọng tiếng Việt, vào <em>Cài đặt →
                Quản lý chung → Ngôn ngữ → Chuyển văn bản thành lời nói</em>,
                cài <strong>Google TTS</strong> + tải gói <strong>Tiếng Việt</strong>.
              </p>
            </div>

            <div className="py-4">
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      'Xóa hết sao của bé? Thao tác này không khôi phục được.',
                    )
                  ) {
                    onResetStars();
                    setOpen(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-[#ffebee] text-[#c62828] font-bold border border-[#ef9a9a] active:scale-95"
              >
                Xóa hết sao
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#42a5f5] text-white font-bold shadow active:scale-95"
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </>
  );
}
