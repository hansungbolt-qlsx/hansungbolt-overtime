import type { MetadataRoute } from 'next';

// Khai báo app là "ứng dụng" (anh Hữu chốt 07/11/2026): trước đây biểu tượng trên màn hình chính chỉ là
// lối tắt ⇒ mỗi lần bấm Safari/Chrome lại mở THÊM 1 TAB. Có manifest display=standalone:
//   · Android Chrome: hiện "Cài đặt ứng dụng", mở cửa sổ riêng, dùng chung đăng nhập với Chrome
//   · iPhone: "Thêm vào MH chính" thành app riêng (kèm thẻ apple-mobile-web-app-capable ở layout)
// Biểu tượng cũ đã thêm trước đó KHÔNG tự đổi — phải xoá rồi thêm lại 1 lần.
// ⚠ middleware.ts phải loại trừ /manifest.webmanifest + /icons/ (trình duyệt tải không kèm cookie).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hansungbolt — Đăng ký tăng ca',
    short_name: 'Hansungbolt',
    description: 'Hệ thống đăng ký tăng ca Hansungbolt Vietnam',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'vi',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
