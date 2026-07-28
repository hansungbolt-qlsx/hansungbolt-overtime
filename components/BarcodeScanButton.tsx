'use client';

// Quét barcode tem cuộn NVL (user chốt 25/7, cải tiến 28/7 sau khi thử thật).
//
// ⚠ BẮT BUỘC dùng thư viện BUNDLE trong app (html5-qrcode) — KHÔNG dựa vào
// `BarcodeDetector` của trình duyệt: iOS Safari không có, mà kho dùng cả Android
// lẫn iPhone. (Vẫn BẬT dùng nó khi máy có — Android nhanh hơn nhiều — nhưng chỉ
// như bộ tăng tốc, ZXing trong thư viện là đường chính.)
//
// 🔴 BÀI HỌC 28/7 — quét LIVE trên iPhone gần như không đọc được mã vạch 1D:
// Code128/Code39 có ~100 vạch mảnh, luồng video mặc định 640×480 lại còn bị crop
// vào khung nhỏ ⇒ mỗi vạch dưới 1 pixel; thêm nữa Safari iOS không lấy nét macro
// qua getUserMedia nên ảnh hơi nhoè. Vì vậy:
//   1. xin luồng 1920×1080 thay vì mặc định
//   2. khung quét rộng gần hết chiều ngang (mã vạch nằm ngang, dài)
//   3. LUÔN có đường "📸 Chụp ảnh tem" — dùng CAMERA GỐC của máy (nét + phân giải
//      đầy đủ + có đèn flash) rồi giải mã từ ảnh. Trên iPhone đây là đường ăn chắc.

import { useCallback, useEffect, useRef, useState } from 'react';

const BOX_ID = 'nvl-barcode-box';
const FILE_BOX_ID = 'nvl-barcode-file-box';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmtOf(r: any): string | undefined {
  const f = r?.result?.format?.formatName ?? r?.result?.format?.format;
  return f ? String(f) : undefined;
}

export default function BarcodeScanButton({
  onScan,
  label = '📷 Quét tem',
}: {
  onScan: (text: string, format?: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
      } catch {
        /* đã dừng */
      }
      try {
        s.clear();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const close = useCallback(() => {
    void stop();
    setOpen(false);
    setSecs(0);
  }, [stop]);

  // Đồng hồ đếm giây — để người dùng biết máy đang thử, không phải treo
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod;
        const scanner = new Html5Qrcode(BOX_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_93,
          ],
          // Android/Chrome có bộ giải mã của hệ điều hành → nhanh và khoẻ hơn.
          // iOS không có thì thư viện tự dùng ZXing như cũ.
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          // ⚠ Tham số này BẮT BUỘC chỉ có ĐÚNG 1 KHOÁ (html5-qrcode
          // html5-qrcode.ts:1261 — `keys.length !== 1` là throw). Truyền thêm
          // width/height vào đây là "Không mở được camera" ngay (đã dính 28/7).
          { facingMode: 'environment' },
          {
            fps: 12,
            // Khung rộng gần hết chiều ngang, thấp — đúng hình dáng mã vạch
            qrbox: (vw: number, vh: number) => ({
              width: Math.floor(vw * 0.94),
              height: Math.max(90, Math.floor(vh * 0.42)),
            }),
            // ĐÂY mới là chỗ xin luồng phân giải cao (mã vạch 1D cần nhiều
            // pixel ngang). Thư viện ưu tiên videoConstraints nếu có.
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (text: string, result: any) => {
            void stop();
            setOpen(false);
            onScan(String(text).trim(), fmtOf(result));
          },
          () => {
            /* mỗi khung không đọc được — im lặng */
          },
        );
      } catch (e) {
        if (!cancelled) {
          // ⚠ html5-qrcode ném CHUỖI, không phải Error → `e instanceof Error`
          // là false và thông báo mất luôn nguyên nhân (đã dính 28/7: chỉ thấy
          // "Không mở được camera", phải đi đọc mã nguồn thư viện mới ra).
          const detail =
            e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
          setErr(`Không mở được camera — ${detail || 'không rõ nguyên nhân'}`);
        }
      }
    })();

    return () => {
      cancelled = true;
      void stop();
    };
  }, [open, onScan, stop]);

  /** Giải mã từ ẢNH chụp bằng camera gốc của máy — nét hơn luồng video rất nhiều. */
  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setBusy(true);
      setErr('');
      await stop();
      try {
        const mod = await import('html5-qrcode');
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod;
        const s = new Html5Qrcode(FILE_BOX_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_93,
          ],
          verbose: false,
        });
        try {
          // scanFileV2 trả kèm loại mã; bản cũ chỉ có scanFile trả chuỗi
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyS = s as any;
          if (typeof anyS.scanFileV2 === 'function') {
            const res = await anyS.scanFileV2(file, false);
            onScan(String(res.decodedText).trim(), fmtOf(res));
          } else {
            const text = await s.scanFile(file, false);
            onScan(String(text).trim(), 'ảnh');
          }
          setOpen(false);
        } finally {
          try {
            s.clear();
          } catch {
            /* ignore */
          }
        }
      } catch {
        setErr(
          'Ảnh này chưa đọc được mã vạch. Chụp lại gần hơn, mã vạch nằm ngang ' +
            'và chiếm gần hết chiều ngang ảnh, bật đèn nếu tối.',
        );
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [onScan, stop],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErr('');
          setSecs(0);
          setOpen(true);
        }}
        className="px-3 py-2 rounded-lg text-sm font-semibold bg-brand-navy text-white active:scale-95 transition"
      >
        {label}
      </button>

      {/* Vùng ẩn cho html5-qrcode giải mã từ file */}
      <div id={FILE_BOX_ID} className="hidden" />

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-3">
          <div className="bg-white rounded-xl p-3 w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-brand-navy">Quét tem cuộn</span>
              <button
                type="button"
                onClick={close}
                className="text-sm text-red-600 font-semibold px-2 py-1"
              >
                Đóng
              </button>
            </div>

            <div id={BOX_ID} className="w-full rounded-lg overflow-hidden bg-black" />

            {err ? (
              <p className="mt-2 text-sm text-red-600 font-semibold">{err}</p>
            ) : (
              <p className="mt-2 text-xs text-brand-navy-soft">
                Đưa mã vạch nằm NGANG, chiếm gần hết chiều ngang khung. Giữ máy yên
                khoảng 2 giây.
                {secs >= 8 && (
                  <span className="block mt-1 text-amber-700 font-semibold">
                    Đã thử {secs}s mà chưa đọc được — bấm “📸 Chụp ảnh tem” bên dưới,
                    camera gốc của máy nét hơn nhiều.
                  </span>
                )}
              </p>
            )}

            {/* Đường ăn chắc trên iPhone: chụp bằng camera gốc rồi giải mã từ ảnh */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="mt-2 w-full py-3 rounded-xl bg-brand-teal text-white font-bold disabled:opacity-50"
            >
              {busy ? 'Đang đọc ảnh…' : '📸 Chụp ảnh tem (nét hơn)'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
