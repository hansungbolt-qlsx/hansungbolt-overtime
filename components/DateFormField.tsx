'use client';

import { useState } from 'react';
import DateButton from './DateButton';

// Ô ngày kiểu chung (DateButton) dùng trong <form method="get"> của trang server:
// giữ giá trị trong ô ẩn `name` để nút Xem gửi đi như ô <input type="date"> cũ.
export default function DateFormField({
  name,
  defaultValue,
  className = '',
}: {
  name: string;
  defaultValue: string;
  className?: string;
}) {
  const [v, setV] = useState(defaultValue);
  return (
    <>
      <DateButton value={v} onChange={(x) => x && setV(x)} className={className} />
      <input type="hidden" name={name} value={v} />
    </>
  );
}
