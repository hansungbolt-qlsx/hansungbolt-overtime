# Hansungbolt Print Agent

Nhận lệnh in từ app Hansungbolt Overtime (tổ trưởng bấm "Gửi in" ở app) và gửi tới máy in laser trên máy tính này.

## Nguyên lý

```
Điện thoại tổ trưởng (4G) ──► Vercel (app) ──► Máy tính này (agent) ──► Máy in laser
```

Agent poll app mỗi 10 giây. Nếu có job pending → render PDF từ URL view phiếu → gửi máy in ApeosPort qua Windows Print API.

## Yêu cầu

- Windows 10 hoặc 11
- Node.js 20+ ([tải LTS](https://nodejs.org))
- Máy in đã cài driver + kết nối OK trên Control Panel > Devices and Printers
- Kết nối Internet ổn định (app nhận lệnh in cả ngày — PC tắt thì job hết hạn TTL)

## Cài đặt lần đầu (~10 phút)

### Bước 1: Copy folder này về máy tính admin

Copy nguyên folder `print-agent/` vào 1 vị trí cố định, ví dụ `C:\hansungbolt-print-agent\`.

### Bước 2: Tạo file `.env`

Copy `.env.example` thành `.env` trong cùng folder. Mở `.env` bằng Notepad và điền:

- `LOGIN_PASSWORD` = password của user `qlsx` (admin)
- `PRINTER_NAME` = tên máy in trong Windows. Kiểm tra bằng cách:
  1. Control Panel → Devices and Printers
  2. Copy tên máy in đúng chính xác, vd: `ApeosPort-VI C4471`

Các biến khác (`APP_URL`, `AGENT_SECRET`) đã điền sẵn — **không đổi**.

### Bước 3: Chạy install.bat

Double-click `install.bat` trong folder. Script sẽ:
- Kiểm tra Node.js
- Chạy `npm install` (lần đầu tải Chromium ~200MB, mất 3-5 phút)

Sau khi xong hiện `=== Cai dat xong ===` → OK.

### Bước 4: Test chạy agent

Double-click `start.bat`. Cửa sổ Command Prompt mở ra, hiển thị:
```
Hansungbolt Print Agent
App: https://hansungbolt-overtime.vercel.app
Printer: ApeosPort-VI C4471
Poll interval: 10000ms

Login as qlsx...
Login OK
Launch Chromium...
```

Nếu không có lỗi → agent đang chạy. Cửa sổ này phải để mở khi muốn agent hoạt động.

### Bước 5: Test in thử

1. Mở điện thoại → login app → tab Đăng ký tăng ca.
2. Bấm nút cam **"Gửi in"** ở 1 phiếu bất kỳ.
3. Chờ ~15 giây → máy in ApeosPort nhả giấy ra.
4. Cửa sổ agent log:
   ```
   Found 1 pending job(s)
   Processing job xxxxxxxx... (type=registration)
   Navigate: https://...
   Sent to printer: ApeosPort-VI C4471
   DONE job xxxxxxxx
   ```

## Auto-start khi Windows boot (khuyến nghị)

Để agent tự chạy mỗi khi bật máy, tạo shortcut vào Startup folder:

1. Nhấn `Win + R` → gõ `shell:startup` → Enter.
2. Folder Startup mở ra.
3. Chuột phải `start.bat` (trong folder print-agent) → **Create shortcut** → di chuyển shortcut vào folder Startup vừa mở.
4. Từ lần khởi động Windows sau, agent tự bật.

## Xử lý sự cố

### Cửa sổ agent tự đóng ngay
- Có lỗi trong login/config. Chạy `start.bat`, đọc thông báo lỗi trước khi nó đóng.
- Thường do sai `LOGIN_PASSWORD` hoặc `PRINTER_NAME`.

### Bấm "Gửi in" xong máy in không nhả giấy
- Kiểm tra cửa sổ agent có chạy không (Task Manager có `node.exe`?).
- Nếu agent đang chạy nhưng không thấy log → job chưa được gửi lên Vercel. Kiểm tra Internet điện thoại.
- Nếu agent log có "ERROR" → chụp màn hình báo Claude.

### Đổi password user qlsx
- Mở `.env`, cập nhật `LOGIN_PASSWORD`.
- Restart agent: đóng cửa sổ Command Prompt, double-click lại `start.bat`.

### Đổi máy in
- Mở `.env`, cập nhật `PRINTER_NAME`.
- Restart agent.

## Bảo mật

- File `.env` chứa password admin. **Không share/upload file này**.
- `AGENT_SECRET` cho phép agent gọi API. **Không share bí mật này**.
- Nếu nghi bị lộ → báo Claude sinh secret mới + update trên Vercel.

## Uninstall

- Xóa folder này khỏi máy.
- Xóa shortcut trong Startup folder (nếu có).
- App vẫn hoạt động bình thường, chỉ nút "Gửi in" không có tác dụng.
