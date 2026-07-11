'use client';

import { useEffect } from 'react';

/**
 * Thu nhỏ phiếu A4 vừa bề ngang màn hình nhỏ (xem trên điện thoại như xem PDF):
 * giữ nguyên layout giấy ở bề rộng chuẩn `baseWidth`, scale cả tờ xuống theo
 * bề ngang khả dụng. Desktop (≥768px) và khi IN không ảnh hưởng.
 * Đặt ngay sau phần tử cần scale; phần tử phải nằm trong 1 wrapper riêng
 * (wrapper được set height theo tờ đã scale vì transform không chiếm layout).
 */
export default function MobileFitScale({
  selector = '.ot-form',
  boxSelector = '.ot-fitbox',
  baseWidth = 760,
}: {
  selector?: string;
  boxSelector?: string;
  baseWidth?: number;
}) {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(selector);
    const box = document.querySelector<HTMLElement>(boxSelector);
    if (!el || !box) return;

    const reset = () => {
      el.style.width = '';
      el.style.transform = '';
      el.style.transformOrigin = '';
      box.style.height = '';
    };

    const fit = () => {
      const avail = box.clientWidth;
      if (window.innerWidth >= 768 || avail >= baseWidth) {
        reset();
        return;
      }
      const k = avail / baseWidth;
      el.style.width = `${baseWidth}px`;
      el.style.transformOrigin = 'top left';
      el.style.transform = `scale(${k})`;
      box.style.height = `${el.offsetHeight * k}px`;
    };

    fit();
    // Logo/ảnh tải xong làm đổi chiều cao → đo lại
    const t1 = setTimeout(fit, 300);
    const t2 = setTimeout(fit, 1200);
    window.addEventListener('resize', fit);
    window.addEventListener('beforeprint', reset);
    window.addEventListener('afterprint', fit);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', fit);
      window.removeEventListener('beforeprint', reset);
      window.removeEventListener('afterprint', fit);
    };
  }, [selector, boxSelector, baseWidth]);

  return null;
}
