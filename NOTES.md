# Debug Notes — Auto Crop Tem NVL

## Mục tiêu
Khi nhân viên upload ảnh chụp tem NVL (chụp xa, lấy nhiều nền thừa), server tự động crop chỉ lấy vùng tem, bỏ phần nền bên ngoài.

---

## Các loại tem thực tế (đã có ảnh mẫu)

| Loại | Màu nền | Nhà cung cấp |
|---|---|---|
| Daeho vàng | Vàng sáng (#FFDC00 approx) | Daeho Special Steel Vina |
| Daeho trắng | Trắng/kem | Daeho Special Steel Vina |
| Daeho xanh/cyan | Xanh dương nhạt (SCM/GSCM series) | Daeho Special Steel Vina |
| NGK/IP trắng | Trắng, có sticker tròn cam/xanh lá | NGK |
| KOS | Trắng nền + viền xanh lá đậm | KOS |
| Vinh Thành | Trắng, dạng bảng/table | Công ty TNHH Thép Vĩnh Thành |

Nền chụp phổ biến: **sắt sơn xanh lá nhà máy** (thuận lợi cho detection).

---

## Lịch sử thử nghiệm

### Lần 1 — Chỉ detect màu vàng
- **Commit:** `df1a993`
- **Cách làm:** Scan toàn bộ pixel, tìm vùng màu vàng `R>155, G>110, B<110`, lấy bounding box
- **Kết quả:** Hoạt động tốt với tem Daeho vàng trên nền xanh. Không crop được tem trắng/xanh

### Lần 2 — Đa chiến lược (4 strategies)
- **Commit:** `3e6af56`
- **Cách làm:**
  1. Yellow: `R>155, G>110, B<115`
  2. Cyan/blue: `B>170, G>135, R<180, B-R>45`
  3. Non-green region (khi nền xanh lá >18%): pixel sáng không xanh lá
  4. White region (khi viền không trắng): `R>185, G>185, B>185`
- **Kết quả (từ print preview thực tế):**
  - Tem vàng: **crop được** nhưng bounding box kéo dài xuống nền wallchart/bảng bên dưới
  - KOS trắng viền xanh: **crop được** tương đối ổn
  - Tem trắng trên túi nhựa kẻ sọc xanh: **sai** — cyan predicate nhận nhầm màu xanh của túi nhựa

### Lần 3 — Density-based row/column filtering (HIỆN TẠI)
- **Commit:** `04b239c`
- **Cách làm:**
  - Thay bounding box đơn giản bằng **density scan**: chỉ lấy hàng có `≥rowMin%` pixel khớp, cột có `≥colMin%` pixel khớp
  - Ngưỡng: yellow row≥20% col≥10%, cyan row≥18%, non-green row≥25%, white row≥45%
  - Siết chặt cyan: `B>185, G>168, R<158, B-R>60, G-R>40` — `G>168` phân biệt Daeho SCM (G~200) với túi nhựa xanh (G~155)
- **Kết quả:** Chưa test đầy đủ sau deploy (user đang thử)
- **Kỳ vọng:**
  - Tem vàng + wallchart bên dưới: hàng wallchart có <5% pixel vàng → bị lọc bỏ ✓
  - Túi nhựa kẻ sọc xanh: G~155 < 168 → không trigger cyan ✓
  - Tem trắng trên nền xanh lá: non-green strategy row≥25% ✓

---

## Vấn đề còn tồn đọng / chưa chắc chắn

1. **Tem trắng trên nền KHÔNG xanh lá** (túi nhựa kẻ sọc, nền hỗn hợp):
   - White strategy: nền kẻ sọc có ~40-50% pixel trắng/hàng → khó phân biệt với tem (60-75%)
   - Chưa có giải pháp tốt hơn ngoài AI/vision API
   - **Hiện tại fallback:** trả về ảnh gốc nếu không detect được

2. **Góc chụp nghiêng:** Bounding box crop thẳng, tem nghiêng sẽ có thêm góc nền. Perspective correction chưa implement.

3. **Nhiều tem trong 1 ảnh:** Chưa xử lý, lấy toàn bộ vùng màu thay vì 1 tem cụ thể.

---

## Hướng tiếp theo nếu cần cải thiện thêm

### Option A — Tối ưu thêm color thresholds
- Thu thập thêm ảnh thực tế bị crop sai
- Phân tích pixel value thực tế → điều chỉnh ngưỡng

### Option B — Dùng Claude Vision API (chính xác nhất)
- Gửi ảnh thumbnail qua `claude-haiku-4-5` API
- Prompt: "Return JSON bounding box of the label sticker in this image"
- Chi phí: ~$0.001-0.003/ảnh
- Cần thêm `ANTHROPIC_API_KEY` vào Vercel Environment Variables
- Độ chính xác ~95% cho mọi loại tem, mọi nền

### Option C — Client-side crop UI
- Hiển thị ảnh trước khi upload, cho user kéo crop box
- Chính xác 100% nhưng thêm bước cho user

---

## Files liên quan

- `app/api/labels/route.ts` — hàm `cropLabel()` (toàn bộ logic crop server-side)
- `lib/hd-employees.ts` — danh sách 14 nhân viên HD + helper `toStorageKey`, `resolveDisplayName`
- `components/MaterialLabelsUpload.tsx` — UI upload phía nhân viên (localStorage tên)
- `components/MaterialLabelsAdminCard.tsx` — UI admin 3 tab: Xem / Tải Excel / In tem
- `app/print/labels/` — trang in A4, 2×4 grid, auto-print dialog
- `app/api/labels/export/route.ts` — export Excel với ảnh nhúng (ExcelJS)
