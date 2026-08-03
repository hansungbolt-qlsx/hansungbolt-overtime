@AGENTS.md
@PROJECT_CONTEXT.md

# CLAUDE.md — App Tăng ca Hansungbolt

> Hai dòng import ở trên nạp sẵn: quy ước Next.js (`AGENTS.md`) và toàn bộ
> bối cảnh dự án 28 KB (`PROJECT_CONTEXT.md`).
> Phần dưới đây là **luật làm việc**, bổ sung 01/08/2026.

---

## 🚦 BẢY QUY TẮC — giống hệt app chính

Bản đầy đủ: `f:\0. Quản lý nguyên liệu\hsb-material-app\CLAUDE.md` mục 0.

| | Quy tắc |
|---|---|
| 1️⃣ | Báo "xong" **phải kèm kết quả cụ thể** chứng minh — số liệu, output lệnh, đối chiếu |
| 2️⃣ | Chỉ báo cáo điều **chứng minh được**. Chưa soi xong thì chưa kết luận |
| 3️⃣ | Chưa kiểm chứng được → **nói thẳng**, đừng đoán |
| 4️⃣ | Sản phẩm là **báo cáo, rồi DỪNG**. Không tự sửa, không tự chạy tiếp |
| 5️⃣ | **Soi rủi ro dữ liệu TRƯỚC khi gõ dòng code đầu tiên** (xem dưới) |
| 6️⃣ | **Đúng phạm vi** — đơn giản nhất mà vẫn đúng. Hai cách cùng đúng → chọn cách ít code hơn |
| 7️⃣ | Mọi báo cáo kết thúc bằng khối **"ĐỀ XUẤT — CHƯA LÀM GÌ CẢ"**, tối đa 3 mục |

**Câu của anh Hữu, đứng trên tất cả:**
> *"Tuyệt đối không được ảnh hưởng đến các dữ liệu thật đang chạy trên app.*
> *Khi code luôn luôn tự kiểm tra, không được bịa code theo suy diễn.*
> *Tôi không cần nhanh mà cần ưu tiên độ chính xác tuyệt đối."*

---

## ⛔ BỐN ĐIỀU NGUY HIỂM RIÊNG CỦA APP NÀY

### 1. `git push origin main` = **DEPLOY THẲNG RA SẢN XUẤT**

Không có bản thử. Đẩy xong 1–2 phút là anh Cường và tổ trưởng dùng bản mới.
**Không đẩy khi chưa chắc chắn.** Trước mỗi lần đẩy:

```bash
npx tsc --noEmit        # phải sạch lỗi
git status              # xem đúng những gì mình định đẩy
git commit -F <file>    # tiếng Việt gõ thẳng bị lỗi mã
```

Lời commit bắt đầu bằng `auto: deploy update` + mô tả tiếng Việt.

### 2. Supabase = **dữ liệu chấm công thật của cả nhà máy**

19 bảng · ~3.000 dòng *(01/08/2026)*. Đây là **giờ công để tính lương**.

- **CẤM** chạy lệnh ghi/sửa/xoá lên Supabase để "thử cho nhanh".
- Sửa dữ liệu là việc của người dùng, thao tác trên giao diện.
- Migration đặt trong `docs/sql/NN-*.sql`, đánh số tăng dần, **anh Hữu tự chạy**
  trên Supabase SQL Editor — Claude không chạy thay.
- Bài học đã trả giá: cập nhật phiếu phải theo kiểu **so-sánh-rồi-sửa**
  (diff-based), **KHÔNG xoá-hết-rồi-thêm-lại** — xem `PROJECT_CONTEXT.md` 4.1.

### 3. Vercel chạy giờ **UTC**, không phải giờ Việt Nam

Mọi phép tính ngày/giờ: **cộng 7 giờ rồi mới `getUTC*`**. Quên là lệch một ngày,
và lệch **âm thầm** — phiếu nhảy sang ngày khác mà không có lỗi nào báo.

### 4. `print-agent/` **không** được deploy lên Vercel

Nó là chương trình thường trú **trên PC của anh Hữu**, chạy qua Task Scheduler
`HansungbolPrintAgent` (mỗi 5 phút), nói chuyện với máy in thật.
Sửa nó thì phải **in thử một phiếu thật** mới được coi là xong — thấy tiến trình
`node.exe` đang chạy thì **chưa đủ**.

---

## 5️⃣ SOI RỦI RO TRƯỚC KHI VIẾT CODE — 5 câu cho app này

| # | Câu hỏi | Nếu CÓ |
|---|---|---|
| 1 | Có ghi/sửa/xoá gì trên **Supabase** không? | 🛑 dừng, báo cáo trước |
| 2 | Có đổi cấu trúc bảng (migration) không? | 🛑 dừng |
| 3 | Có định `git push` lên `main` không? | 🛑 xin phép — đó là deploy thật |
| 4 | Có chạm `print-agent/` không? | 🛑 phải in thử phiếu thật |
| 5 | Chạy sai một lần thì hỏng gì — **lùi lại được không**? | không lùi được → 🛑 dừng |

Báo cáo phải đủ 5 ý: *định làm gì · chạm vào đâu · sai thì hỏng gì ·
**lùi lại thế nào** · có cách nào an toàn hơn không.*

---

## 🔗 QUAN HỆ VỚI APP CHÍNH

App này **không đứng một mình**. Hai chiều nối:

| Chiều | Việc | Đường |
|---|---|---|
| App chính → đây | Đẩy Kế hoạch SX (KHSX) sang cho tổ trưởng xem | `/api/upload-plan` |
| Đây → app chính | Agent gửi phiếu xuất/trả kho NPL, kéo tồn kho | `/api/ot/*` trên app chính |

Sửa một trong hai chiều thì **phải kiểm cả hai đầu**. Bài học 28/07/2026:
**120 assert PASS mà vẫn lọt lỗi ở chỗ nối** — phải thử đầu-cuối thật và soi
cả nhật ký của agent, không tin vào test đơn lẻ.

---

## 🌐 NGÔN NGỮ

Giao diện **tiếng Việt**. Người dùng là công nhân và tổ trưởng Việt Nam —
viết chữ dễ hiểu, không dùng từ kỹ thuật, **không viết tắt**.

---

## 💾 BẢN NÀY ĐƯỢC BACKUP THẾ NÀO

Từ 01/08/2026, bản backup OneDrive của app chính gói **cả** app này:
mã nguồn · `print-agent` · **lịch sử Git** (1.904 file) · `.env.local` ·
và **bản xuất JSON toàn bộ Supabase** (19 bảng).
`node_modules` và `.next` không gói — `npm install` dựng lại.

---

*Cập nhật 01/08/2026. Chi tiết tính năng, cấu trúc bảng, lịch sử quyết định:
xem `PROJECT_CONTEXT.md`.*
