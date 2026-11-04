// next/image + next/link GIẢ — để render phiếu in ra HTML ngoài Next.js.
import { createElement } from 'react';
export default function Gia({ href, src, alt, children }) {
  return href !== undefined
    ? createElement('a', { href: String(href) }, children)
    : createElement('img', { src: typeof src === 'string' ? src : '', alt });
}
