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
  const [step, setStep] = useState('');   // tiến trình đọc ảnh
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
          // Chỉ 3 định dạng có thật trên tem — chống đọc bừa (xem ghi chú ở onFile)
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
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
            // KHÔNG đặt qrbox → quét TOÀN KHUNG. Lợi 2 điều: (1) mã vạch 1D dài
            // nên càng nhiều pixel ngang càng dễ đọc, (2) không có lớp phủ khung
            // nào để lệch khi CSS co video lại cho vừa modal (bug 28/7: video
            // phình to, "chia 2 phân vùng", đẩy nút Đóng ra khỏi màn hình).
            // ĐÂY mới là chỗ xin luồng phân giải cao — 1280×720 là mức vừa đủ
            // tốt cho mã vạch mà không làm phần tử video quá khổ.
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
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

  /** Giải mã từ ẢNH chụp bằng camera gốc của máy.
   *
   * 🔴 NGUYÊN NHÂN GỐC tìm được 28/7 (giải mã thử 5 tem mẫu bằng chính ZXing):
   * bộ đọc mã 1D của ZXing CHỈ dò một số DÒNG NGANG QUANH GIỮA ảnh. Mã vạch trên
   * tem cuộn NVL luôn nằm ở ĐÁY tem (Daeho, KOS, Nhuận Thái, Thái Lan, Vĩnh
   * Thành — cả 5 đều vậy) nên không bao giờ được dò tới ⇒ ảnh nguyên tấm LUÔN
   * thất bại, dù ảnh nét. Cắt thành dải ngang + phóng to lên thì cả 5 đọc được
   * ngay (CODE_128 ×3, CODE_39 ×1, QR ×1).
   *
   * Vì vậy: thử ảnh nguyên trước (nhanh, bắt QR), rồi TRƯỢT 6 DẢI NGANG từ trên
   * xuống, mỗi dải cao 30% ảnh và phóng về tối thiểu ~1.400 px ngang.
   */
  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setBusy(true);
      setErr('');
      setStep('');
      await stop();
      try {
        const mod = await import('html5-qrcode');
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod;
        const s = new Html5Qrcode(FILE_BOX_ID, {
          // ⚠ CHỈ 3 định dạng CÓ THẬT trên tem 5 NCC. Thử nghiệm 28/7: để rộng
          // thêm EAN/ITF/CODE_93 thì có ca đọc BỪA thành EAN_8 "21558788" trong
          // khi giá trị đúng là CODE_39 "RP00226031324" → tick SAI CUỘN.
          // Thu hẹp danh sách là cách chống đọc sai rẻ nhất. ĐỪNG nới lại.
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,   // Daeho · KOS · POS-SEAH
            Html5QrcodeSupportedFormats.CODE_39,    // Nhuận Thái
            Html5QrcodeSupportedFormats.QR_CODE,    // Vĩnh Thành
          ],
          verbose: false,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyS = s as any;
        const scanOne = async (f: File) => {
          if (typeof anyS.scanFileV2 === 'function') {
            const res = await anyS.scanFileV2(f, false);
            return { text: String(res.decodedText).trim(), fmt: fmtOf(res) };
          }
          const text = await s.scanFile(f, false);
          return { text: String(text).trim(), fmt: undefined };
        };

        let hit: { text: string; fmt?: string } | null = null;
        try {
          // 1) Ảnh nguyên tấm — bắt QR rất nhanh
          setStep('đang đọc ảnh…');
          try {
            hit = await scanOne(file);
          } catch {
            /* sang bước cắt dải */
          }

          // 2) Trượt dải ngang — cách DUY NHẤT đọc được mã 1D ở đáy tem.
          //
          // Công thức dưới đây là kết quả ĐO THẬT 28/7 trên 4 tem mẫu, mô phỏng
          // ảnh chụp điện thoại ở nhiều mức xa/mờ (xem docs mục 4.2):
          //   · DẢI HẸP 12% cao, chồng nhau 50% → mọi ca thành công đều rơi vào
          //     mức này, dải 25-30% thì trượt
          //   · dò TỪ DƯỚI LÊN — mã vạch luôn ở đáy tem nên ra rất nhanh
          //   · NHỊ PHÂN HOÁ (đen/trắng theo ngưỡng trung bình) là biến thể cứu
          //     được tem Daeho (nền vàng, bọc nilon bóng) mà ảnh thường thất bại
          if (!hit) {
            const bmp = await createImageBitmap(file);
            const W = bmp.width;
            const H = bmp.height;
            const bandH = Math.max(48, Math.round(H * 0.12));
            const stepPx = Math.max(24, Math.round(bandH / 2));
            const tops: number[] = [];
            for (let top = H - bandH; top >= 0; top -= stepPx) tops.push(top);
            if (tops[tops.length - 1] !== 0) tops.push(0);

            const scale = Math.min(3, Math.max(1.5, 1600 / W));
            const cv = document.createElement('canvas');
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            cv.width = Math.round(W * scale);
            cv.height = Math.round(bandH * scale);

            const toFile = async (name: string) => {
              const blob: Blob | null = await new Promise((res) =>
                cv.toBlob((b) => res(b), 'image/png'),
              );
              return blob ? new File([blob], name, { type: 'image/png' }) : null;
            };

            // Nhị phân hoá theo ngưỡng TRUNG BÌNH của chính dải đó — tự thích ứng
            // với tem sáng/tối, tốt hơn ngưỡng cố định.
            const binarize = () => {
              if (!ctx) return;
              const im = ctx.getImageData(0, 0, cv.width, cv.height);
              const d = im.data;
              let sum = 0;
              for (let i = 0; i < d.length; i += 4) {
                sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
              }
              const mean = sum / (d.length / 4);
              for (let i = 0; i < d.length; i += 4) {
                const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 > mean ? 255 : 0;
                d[i] = d[i + 1] = d[i + 2] = v;
              }
              ctx.putImageData(im, 0, 0);
            };

            for (let k = 0; k < tops.length && !hit; k++) {
              setStep(`đang dò ${k + 1}/${tops.length}…`);
              // lượt 1: ảnh thường · lượt 2: nhị phân hoá (cứu tem nền vàng/bóng)
              for (const bin of [false, true]) {
                ctx?.drawImage(bmp, 0, tops[k], W, bandH, 0, 0, cv.width, cv.height);
                if (bin) binarize();
                const f = await toFile(`b${k}${bin ? 'x' : ''}.png`);
                if (!f) continue;
                try {
                  hit = await scanOne(f);
                  break;
                } catch {
                  /* thử biến thể / dải kế tiếp */
                }
              }
            }
            bmp.close?.();
          }
        } finally {
          try {
            s.clear();
          } catch {
            /* ignore */
          }
        }

        if (!hit) throw new Error('no-code');
        onScan(hit.text, hit.fmt || 'ảnh');
        setOpen(false);
      } catch {
        setErr(
          'Chưa đọc được mã vạch trong ảnh. Chụp lại sao cho MÃ VẠCH nằm ngang, ' +
            'chiếm gần hết chiều ngang ảnh, không bị nhăn/bóng, bật đèn nếu tối.',
        );
      } finally {
        setBusy(false);
        setStep('');
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
        // Bố cục CHỐNG VỠ: khung cố định cả màn hình, chia 3 tầng —
        // đầu (Đóng) và chân (2 nút) KHÔNG co, chỉ vùng video co giãn. Nhờ vậy
        // nút thoát luôn nhìn thấy kể cả khi video bị thư viện đặt sai kích cỡ
        // (bug 28/7: nút Đóng bị đẩy ra khỏi màn hình, không huỷ được lệnh quét).
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col p-3">
          <div className="bg-white rounded-xl p-3 w-full max-w-md mx-auto my-auto flex flex-col max-h-full overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="font-bold text-brand-navy">Quét tem cuộn</span>
              <button
                type="button"
                onClick={close}
                className="text-base text-white bg-red-600 font-bold px-4 py-2 rounded-lg active:scale-95"
              >
                ✕ Đóng
              </button>
            </div>

            <div
              id={BOX_ID}
              className="w-full rounded-lg overflow-hidden bg-black shrink-0"
            />

            <div className="mt-2 overflow-auto min-h-0">
              {err ? (
                <p className="text-sm text-red-600 font-semibold break-words">{err}</p>
              ) : (
                <p className="text-xs text-brand-navy-soft">
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
            </div>

            {/* Đường ăn chắc trên iPhone: chụp bằng camera gốc rồi giải mã từ ảnh */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <div className="mt-2 shrink-0 space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="w-full py-3 rounded-xl bg-brand-teal text-white font-bold disabled:opacity-50"
              >
                {busy ? (step || 'Đang đọc ảnh…') : '📸 Chụp ảnh tem (nét hơn)'}
              </button>
              {/* Nút huỷ thứ 2 ở chân — ngón tay ở dưới màn hình dễ với hơn */}
              <button
                type="button"
                onClick={close}
                className="w-full py-3 rounded-xl border-2 border-red-500 text-red-600 font-bold"
              >
                ✕ Huỷ quét
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
