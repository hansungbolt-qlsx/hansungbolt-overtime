// Thu nhỏ ảnh NGAY TRÊN ĐIỆN THOẠI trước khi gửi (anh Hữu 27/10/2026: tem NVL qua 4G chờ 1–2 phút/ảnh).
// Ảnh gốc iPhone vài MB → cạnh dài 1600px JPEG q0.8 (~200–400KB) = đúng mức máy chủ đang nén
// (orientForLandscapeSlot trong app/api/labels/route.ts) nên ảnh lưu/in KHÔNG đổi chất lượng.
// Trình duyệt đời mới vẽ <img> theo EXIF orientation → canvas ra ảnh đúng chiều, máy chủ vẫn xoay dọc→ngang như cũ.
// Lỗi bất kỳ (máy cũ, định dạng lạ) hoặc nén ra không nhỏ hơn → trả lại file GỐC (không tệ hơn trước).

const MAX_EDGE = 1600;
const QUALITY = 0.8;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

export async function compressImage(file: File): Promise<File> {
  try {
    const img = await loadImage(file);
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) return file;
    const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALITY));
    canvas.width = canvas.height = 0; // giải phóng bộ nhớ sớm trên điện thoại
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
