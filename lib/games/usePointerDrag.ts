'use client';

import { useRef, useState } from 'react';

// Hook kéo thả dùng chung cho mọi game — Pointer Events (chạy cả cảm
// ứng tablet + chuột). KHÔNG dùng HTML5 drag-and-drop.
//
// Cách dùng:
//   const { drag, dragProps } = usePointerDrag<MyPayload>((p, x, y) => {...});
//   <button {...dragProps(payload)}>...</button>
//   {drag && <FloatingClone x={drag.x} y={drag.y} .../>}

export type DragState<T> = { payload: T; x: number; y: number };

export function usePointerDrag<T>(
  onDrop: (payload: T, x: number, y: number) => void,
) {
  const [drag, setDrag] = useState<DragState<T> | null>(null);
  const ref = useRef<DragState<T> | null>(null);

  function set(d: DragState<T> | null) {
    ref.current = d;
    setDrag(d);
  }

  function dragProps(payload: T) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        set({ payload, x: e.clientX, y: e.clientY });
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!ref.current) return;
        set({ ...ref.current, x: e.clientX, y: e.clientY });
      },
      onPointerUp: (e: React.PointerEvent) => {
        const d = ref.current;
        set(null);
        if (d) onDrop(d.payload, e.clientX, e.clientY);
      },
      onPointerCancel: () => set(null),
    };
  }

  return { drag, dragProps };
}

// Điểm (x,y) có nằm trong element không — pad = vùng nới rộng (snap khi
// thả gần, mặc định 50px cho tay bé 4 tuổi).
export function hitTestEl(
  el: HTMLElement | null | undefined,
  x: number,
  y: number,
  pad = 50,
): boolean {
  if (!el) return false;
  const b = el.getBoundingClientRect();
  return (
    x >= b.left - pad &&
    x <= b.right + pad &&
    y >= b.top - pad &&
    y <= b.bottom + pad
  );
}
