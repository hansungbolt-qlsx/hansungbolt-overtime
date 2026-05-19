'use client';

// Hiệu ứng ăn mừng dùng chung — confetti emoji + dòng chữ "Giỏi quá!".
export default function Celebrate({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className="absolute text-3xl animate-[gfall_3s_linear_forwards]"
          style={{
            left: `${(i * 2.8) % 100}%`,
            top: '-10%',
            animationDelay: `${(i % 9) * 0.12}s`,
          }}
        >
          {['🎉', '⭐', '🎈', '🌟', '🏆'][i % 5]}
        </span>
      ))}
      <div className="text-5xl sm:text-6xl font-extrabold text-[#e65100] bg-white/80 px-10 py-6 rounded-3xl shadow-2xl animate-[gpop_0.5s_ease-out]">
        🎉 Giỏi quá! 🎉
      </div>
      <style>{`
        @keyframes gfall { to { transform: translateY(115vh) rotate(360deg); } }
        @keyframes gpop { 0%{transform:scale(0.3);opacity:0} 100%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}
