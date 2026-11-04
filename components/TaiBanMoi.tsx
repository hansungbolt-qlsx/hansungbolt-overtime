'use client';

import { useEffect, useState } from 'react';
import { coDangNhapDo } from '@/lib/dang-nhap-do';

// Luôn chạy bản mới nhất trên điện thoại (anh Hữu 04/11/2026).
// Điện thoại giữ trang cũ trong bộ nhớ: mở lại app là hiện ngay trang cũ, KHÔNG hỏi máy chủ
// → sau khi deploy, tổ trưởng vẫn dùng bản cũ (vd. không thấy nút 3h / 4h / Khác).
//
// Cách làm: mỗi bản build mang mã phiên bản (NEXT_PUBLIC_BAN_DUNG, đặt trong next.config.ts);
// /api/version trả mã của bản đang chạy trên máy chủ. Mở trang / quay lại app thì so hai mã:
//   - Khác mã (có bản mới)            → tự tải lại trang.
//   - Rời app ≥ 10 phút rồi quay lại   → tự tải lại trang (lấy luôn dữ liệu mới nhất).
//   - Đang nhập dở phiếu (lib/dang-nhap-do) → KHÔNG tự tải lại (mất dữ liệu); có bản mới thì hiện
//     thanh báo + nút "Tải lại" để tổ trưởng gửi/lưu xong rồi tự bấm.
//   - Mất mạng / máy chủ lỗi → không làm gì (tải lại lúc mất mạng chỉ ra trang lỗi).
// Chống lặp: đã tự tải lại vì mã X mà vẫn thấy khác X thì không tải nữa, chỉ hiện thanh báo.

const BAN_DUNG = process.env.NEXT_PUBLIC_BAN_DUNG || 'local';
const VANG_LAU_MS = 10 * 60 * 1000;
const KHOA_CHONG_LAP = 'hsb-da-tai-ban';

async function hoiMayChu(): Promise<{ ok: boolean; banMoi: string | null }> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return { ok: false, banMoi: null };
    const d = await res.json();
    const v = typeof d?.v === 'string' ? d.v : '';
    const khac = v !== '' && v !== 'local' && BAN_DUNG !== 'local' && v !== BAN_DUNG;
    return { ok: true, banMoi: khac ? v : null };
  } catch {
    return { ok: false, banMoi: null };
  }
}

function docKhoa(): string | null {
  try { return window.sessionStorage.getItem(KHOA_CHONG_LAP); } catch { return null; }
}
function ghiKhoa(v: string) {
  try { window.sessionStorage.setItem(KHOA_CHONG_LAP, v); } catch { /* không lưu được: vẫn tải lại */ }
}

export default function TaiBanMoi() {
  const [coBanMoi, setCoBanMoi] = useState(false);

  useEffect(() => {
    let anLuc: number | null = document.visibilityState === 'hidden' ? Date.now() : null;
    let dangKiem = false;

    const kiem = async (vangLau: boolean) => {
      if (dangKiem) return;
      dangKiem = true;
      try {
        const { ok, banMoi } = await hoiMayChu();
        if (!ok) return;
        if (coDangNhapDo()) {
          if (banMoi) setCoBanMoi(true);
          return;
        }
        if (banMoi) {
          if (docKhoa() === banMoi) { setCoBanMoi(true); return; } // đã tải lại vì bản này rồi — chống lặp
          ghiKhoa(banMoi);
          window.location.reload();
          return;
        }
        if (vangLau) window.location.reload();
      } finally {
        dangKiem = false;
      }
    };

    kiem(false);
    // Trang được trình duyệt khôi phục nguyên từ bộ nhớ (bấm Quay lại / mở lại tab) = mở lại app
    const khiHienLai = (e: PageTransitionEvent) => { if (e.persisted) kiem(true); };
    const khiDoiTrangThai = () => {
      if (document.visibilityState === 'hidden') { anLuc = Date.now(); return; }
      const vangLau = anLuc != null && Date.now() - anLuc >= VANG_LAU_MS;
      anLuc = null;
      kiem(vangLau);
    };
    window.addEventListener('pageshow', khiHienLai);
    document.addEventListener('visibilitychange', khiDoiTrangThai);
    return () => {
      window.removeEventListener('pageshow', khiHienLai);
      document.removeEventListener('visibilitychange', khiDoiTrangThai);
    };
  }, []);

  if (!coBanMoi) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-brand-navy text-white px-4 py-2.5 shadow-lg">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <p className="text-sm flex-1 leading-snug">
          Đã có bản mới của app. Gửi hoặc lưu xong phiếu đang nhập rồi bấm Tải lại.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex-shrink-0 bg-white text-brand-navy text-sm font-semibold px-3 py-1.5 rounded-md"
        >
          Tải lại
        </button>
      </div>
    </div>
  );
}
