'use client';

// Quét barcode tem cuộn NVL (user chốt 25/7, giữ nguyên 28/7).
//
// ⚠ BẮT BUỘC dùng thư viện BUNDLE trong app (html5-qrcode) — KHÔNG dùng
// `BarcodeDetector` của trình duyệt: iOS Safari không có, mà nhân viên kho dùng
// cả Android lẫn iPhone.
//
// Thư viện nạp bằng dynamic import → chỉ tải khi bấm Quét, không làm nặng
// trang cho người không dùng.

import { useCallback, useEffect, useRef, useState } from 'react';

const BOX_ID = 'nvl-barcode-box';

export default function BarcodeScanButton({
  onScan,
  label = '📷 Quét tem',
}: {
  /** `format` = tên chuẩn mã (CODE_39 / CODE_128 / QR_CODE…) — cần cho chẩn đoán
   *  vì mỗi NCC in một kiểu tem và 4/5 tem KHÔNG in giá trị mã vạch. */
  onScan: (text: string, format?: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
      } catch {
        /* đã dừng rồi */
      }
      try {
        s.clear();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod;
        const scanner = new Html5Qrcode(BOX_ID, {
          // Tem cuộn NVL in Code39/Code128; để thêm QR phòng khi đổi mẫu tem
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (text: string, result: any) => {
            // Quét trúng → trả về rồi đóng ngay, tránh bắn trùng nhiều lần
            void stop();
            setOpen(false);
            const fmt = result?.result?.format?.formatName
              ?? result?.result?.format?.format
              ?? undefined;
            onScan(String(text).trim(), fmt ? String(fmt) : undefined);
          },
          () => {
            /* mỗi khung hình không đọc được — im lặng */
          },
        );
      } catch (e) {
        if (!cancelled) {
          setErr(
            e instanceof Error
              ? `Không mở được camera: ${e.message}`
              : 'Không mở được camera',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      void stop();
    };
  }, [open, onScan, stop]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErr('');
          setOpen(true);
        }}
        className="px-3 py-2 rounded-lg text-sm font-semibold bg-brand-navy text-white active:scale-95 transition"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-xl p-3 w-full max-w-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-brand-navy">Quét tem cuộn</span>
              <button
                type="button"
                onClick={() => {
                  void stop();
                  setOpen(false);
                }}
                className="text-sm text-red-600 font-semibold px-2 py-1"
              >
                Đóng
              </button>
            </div>
            <div id={BOX_ID} className="w-full rounded-lg overflow-hidden bg-black" />
            {err ? (
              <p className="mt-2 text-sm text-red-600">{err}</p>
            ) : (
              <p className="mt-2 text-xs text-brand-navy-soft">
                Đưa mã vạch trên tem vào khung. Máy đọc xong sẽ tự tick cuộn tương ứng.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
