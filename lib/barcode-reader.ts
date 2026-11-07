// Bộ đọc mã vạch tem NVL / phiếu di chuyển — zxing-wasm (lõi zxing-cpp).
//
// Đổi từ html5-qrcode ngày 07/11/2026 (anh Hữu duyệt): đo trên 5 tem mẫu NCC,
// html5-qrcode quét trực tiếp mã 1D được 0/8, zxing-wasm 10/10 (~15 ms/khung).
//
// ⚠ File .wasm TỰ HOST ở /public/zxing (không tải từ CDN jsDelivr như mặc định của
// thư viện) — mạng kho chập chờn / CDN chặn thì quét vẫn chạy. Tên file có SỐ PHIÊN
// BẢN: nâng zxing-wasm thì chép lại file wasm mới + đổi WASM_URL, nếu không JS và
// wasm lệch phiên bản sẽ hỏng.
//
// ⚠ CHỈ 3 định dạng CÓ THẬT trên tem (bài học 28/7: nới thêm EAN/ITF thì đọc bừa
// CODE_39 "RP00226031324" thành EAN_8 "21558788" → tick SAI CUỘN). ĐỪNG nới.
//   Code128: Daeho · KOS · POS-SEAH(Thái Lan)   Code39: Nhuận Thái + phiếu di chuyển
//   QRCode : Vĩnh Thành

import type { ReaderOptions } from 'zxing-wasm/reader';

export const ZXING_VERSION = '2.2.4';
const WASM_URL = `/zxing/zxing_reader-${ZXING_VERSION}.wasm`;

export const FORMATS = ['Code128', 'Code39', 'QRCode'] as const;

export type ScanHit = { text: string; format: string };

type ZxingMod = typeof import('zxing-wasm/reader');
let modPromise: Promise<ZxingMod> | null = null;

/** Tải thư viện + wasm 1 lần (gọi sớm khi mở màn quét để lúc có khung đầu là sẵn sàng). */
export function loadZxing(): Promise<ZxingMod> {
  if (!modPromise) {
    modPromise = (async () => {
      const mod = await import('zxing-wasm/reader');
      await mod.prepareZXingModule({
        overrides: {
          locateFile: (path: string, prefix: string) =>
            path.endsWith('.wasm') ? WASM_URL : prefix + path,
        },
        fireImmediately: true,
      });
      return mod;
    })().catch((e) => {
      modPromise = null; // lần sau thử tải lại
      throw e;
    });
  }
  return modPromise;
}

// Khung trực tiếp: KHÔNG xoay/đảo màu (người dùng tự đặt mã nằm ngang trong khung) → nhanh.
//
// 2 cách tách đen/trắng chạy XEN KẼ từng khung (đo 07/11/2026 trên 40 khung 1080p
// 5 NCC × 4 cỡ × 2 độ nhoè, chỉ phần trong khung chữ nhật):
//   · FixedThreshold : 30/40, ~5 ms  — khoẻ hẳn với mã nhỏ / hơi nhoè (Daeho nền vàng)
//   · LocalAverage   : 22/40, ~20 ms — mặc định thư viện, chịu ánh sáng KHÔNG đều tốt
//     hơn (tem bị bóng đèn 1 góc) nên vẫn giữ xen kẽ.
export type Binarizer = 'FixedThreshold' | 'LocalAverage';
const liveOpts = (binarizer: Binarizer): ReaderOptions => ({
  formats: [...FORMATS],
  tryHarder: true,
  tryRotate: false,
  tryInvert: false,
  maxNumberOfSymbols: 1,
  binarizer,
});

// Ảnh chụp: thử kỹ hơn (xoay 90°, thu nhỏ nhiều mức) — chỉ chạy 1 lần, chậm cũng được.
const PHOTO_OPTS: ReaderOptions = {
  formats: [...FORMATS],
  tryHarder: true,
  tryRotate: true,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

async function read(
  input: ImageData | Blob,
  opts: ReaderOptions,
): Promise<ScanHit | null> {
  const mod = await loadZxing();
  const rs = await mod.readBarcodes(input, opts);
  const ok = rs.find((r) => r.isValid && r.text.trim());
  return ok ? { text: ok.text.trim(), format: String(ok.format) } : null;
}

export function readFrame(img: ImageData, binarizer: Binarizer = 'LocalAverage'): Promise<ScanHit | null> {
  return read(img, liveOpts(binarizer));
}

/** Ảnh chụp: thử LocalAverage rồi FixedThreshold. */
export async function readPhotoPart(input: ImageData | Blob): Promise<ScanHit | null> {
  return (
    (await read(input, PHOTO_OPTS)) ??
    (await read(input, { ...PHOTO_OPTS, binarizer: 'FixedThreshold' }))
  );
}

/** Tên định dạng của BarcodeDetector (Android) → cùng kiểu tên zxing để hiển thị thống nhất. */
export function nativeFormatName(f: string): string {
  if (f === 'code_128') return 'Code128';
  if (f === 'code_39') return 'Code39';
  if (f === 'qr_code') return 'QRCode';
  return f;
}
export const NATIVE_FORMATS = ['code_128', 'code_39', 'qr_code'];

/**
 * Chống đọc sai: Code39 KHÔNG có số kiểm tra ⇒ phải đọc TRÙNG 2 lần liên tiếp
 * (cách nhau ≤ 1,5 s) mới nhận. Code128 (có checksum) & QR (có sửa lỗi) nhận ngay.
 */
export class ConfirmGate {
  private last: { text: string; at: number } | null = null;
  accept(hit: ScanHit, now = Date.now()): boolean {
    if (hit.format !== 'Code39') return true;
    const prev = this.last;
    this.last = { text: hit.text, at: now };
    return !!prev && prev.text === hit.text && now - prev.at <= 1500;
  }
}
