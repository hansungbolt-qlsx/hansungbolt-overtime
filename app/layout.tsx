import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hansungbolt — Đăng ký tăng ca",
  description: "Hệ thống đăng ký tăng ca Hansungbolt Vietnam",
  appleWebApp: {
    title: "Hansungbolt",
    capable: true,
    statusBarStyle: "default",
  },
  // Next chỉ in "mobile-web-app-capable" — iPhone (iOS ≤ 16, vd iPhone X) cần đúng thẻ apple-… mới mở
  // biểu tượng màn hình chính thành app riêng, không sinh tab Safari (anh Hữu 07/11/2026)
  other: { "apple-mobile-web-app-capable": "yes" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
