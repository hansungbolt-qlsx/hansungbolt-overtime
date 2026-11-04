import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Mã phiên bản của bản build (anh Hữu 04/11/2026) — đóng vào cả trang lẫn /api/version lúc build;
    // components/TaiBanMoi so hai mã để điện thoại giữ trang cũ tự tải bản mới. Vercel deploy từ git
    // có VERCEL_GIT_COMMIT_SHA; không có (chạy máy) → 'local' = tắt việc so.
    NEXT_PUBLIC_BAN_DUNG:
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "local",
  },
};

export default nextConfig;
