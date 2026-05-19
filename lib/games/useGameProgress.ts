'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Lưu tiến độ sao của bé. Ưu tiên Supabase (qua /api/games/progress),
// tự fallback localStorage nếu bảng chưa tạo / lỗi mạng → KHÔNG bao giờ
// chặn game, KHÔNG đụng dữ liệu sản xuất.

type GameStat = { playCount: number; stars: number };
type Progress = { stars: number; data: Record<string, GameStat> };

const LS_KEY = 'beHoc.progress';

function readLS(): Progress {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { stars: p.stars ?? 0, data: p.data ?? {} };
    }
  } catch {
    /* ignore */
  }
  return { stars: 0, data: {} };
}

function writeLS(p: Progress) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function useGameProgress() {
  const [prog, setProg] = useState<Progress>({ stars: 0, data: {} });
  const [ready, setReady] = useState(false);
  const source = useRef<'supabase' | 'local'>('local');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/games/progress');
        const j = await res.json();
        if (cancelled) return;
        if (res.ok && j.fallback === false) {
          source.current = 'supabase';
          const p: Progress = { stars: j.stars ?? 0, data: j.data ?? {} };
          setProg(p);
          writeLS(p);
          setReady(true);
          return;
        }
      } catch {
        /* fall through */
      }
      if (cancelled) return;
      source.current = 'local';
      setProg(readLS());
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((p: Progress) => {
    writeLS(p);
    if (source.current === 'supabase') {
      fetch('/api/games/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      }).catch(() => {
        /* offline → localStorage vẫn giữ */
      });
    }
  }, []);

  const addStar = useCallback(
    (gameId: string, n = 1) => {
      setProg((prev) => {
        const g = prev.data[gameId] ?? { playCount: 0, stars: 0 };
        const next: Progress = {
          stars: prev.stars + n,
          data: {
            ...prev.data,
            [gameId]: { playCount: g.playCount + 1, stars: g.stars + n },
          },
        };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    const empty: Progress = { stars: 0, data: {} };
    setProg(empty);
    persist(empty);
  }, [persist]);

  return { stars: prog.stars, data: prog.data, ready, addStar, reset };
}
