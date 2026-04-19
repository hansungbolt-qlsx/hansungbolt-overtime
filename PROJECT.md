# DỰ ÁN: WEB APP ĐĂNG KÝ TĂNG CA — HANSUNGBOLT VIETNAM

## 1. BỐI CẢNH

Công ty Hansungbolt Vietnam chuyên sản xuất bu-lông/vít/đai ốc bằng công nghệ cold forming (rèn nguội), đường kính ren 3mm-12mm. Hiện chưa có hệ thống MES real-time. Tổ trưởng dưới xưởng gửi yêu cầu tăng ca qua Zalo, admin xử lý thủ công (in file).

## 2. MỤC TIÊU

Web app đăng ký tăng ca:
- **Tổ trưởng** dùng điện thoại đăng nhập và đăng ký tăng ca cho bộ phận mình.
- **Admin** xem phiếu real-time trên máy tính, bấm in ra file Excel đúng format phiếu mẫu.
- Triển khai **local trước**, deploy cloud sau.
- **Miễn phí**, dưới 30 user.

## 3. STACK CÔNG NGHỆ

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js 15 (App Router) + Turbopack |
| Ngôn ngữ | TypeScript |
| UI | Tailwind CSS v4 (shadcn/ui sẽ thêm khi cần component phức tạp) |
| Database | Supabase PostgreSQL (region Singapore) |
| Auth | **Custom**: bcryptjs + JWT (jose) + HTTP-only cookie — KHÔNG dùng Supabase Auth native |
| Xuất Excel | ExcelJS |
| Đọc Excel | SheetJS (xlsx) |
| Runtime script | tsx (chạy TypeScript trực tiếp cho seed/migration) |
| Deploy | Local (dev) → Vercel (production) |

## 4. TÀI KHOẢN NGƯỜI DÙNG

| Username | Họ tên | Vai trò | Bộ phận |
|---|---|---|---|
| `qlsx` | Hoàng Chính Hữu | admin | - |
| `hd` | Trần Anh Tuấn | leader | HD |
| `rl` | Bùi Doãn Toàn | leader | RL |

## 5. NHÂN VIÊN

### 5.1. Bộ phận HD (Heading — rèn nguội) — 14 người
1. TRẦN ANH TUẤN (tổ trưởng)
2. NGUYỄN TIẾN DŨNG
3. NGUYỄN XUÂN QUANG
4. PHẠM TUẤN VŨ
5. PHẠM TẤN PHONG
6. HÀ QUỐC ĐIỆP
7. PHẠM HỮU ANH
8. VŨ CÔNG THAO
9. NGUYỄN ĐỨC GIÁP
10. NGUYỄN CẢNH THIẾT
11. NGUYỄN QUỐC BẢO
12. TRẦN XUÂN ĐẠT
13. HỨA TẤN ANH
14. ĐINH MẠNH HOÀNG

### 5.2. Bộ phận RL (Rolling — lăn ren) — 11 người
1. BÙI DOÃN TOÀN (tổ trưởng)
2. DƯƠNG ĐỨC LINH
3. NGUYỄN VĂN TÙNG (A)
4. HỒ VĂN BÁU
5. VÕ VĂN TRÌNH
6. NGUYỄN VĂN TUẤN
7. ĐỖ HUY HOÀNG
8. LÊ ĐÌNH TUẤN
9. NGUYỄN ANH TÚ
10. ĐỖ HOÀNG SƠN
11. LƯƠNG HOÀNG NHÂN

## 6. THIẾT BỊ VÀ RPM

Công thức: **SL/giờ = RPM × 60**

### 6.1. Thiết bị HD (42 máy — 8 Former + 34 Header)

| Mã máy | Quy cách | Loại | RPM |
|---|---|---|---|
| HD-01 | M12 | FORMER | 55 |
| HD-02 | M10 | HEADER | 45 |
| HD-03 | M10 | FORMER | 90 |
| HD-04 | M10 | FORMER | 90 |
| HD-4A | M10 | FORMER | 90 |
| HD-05 | M10 | HEADER | 55 |
| HD-06 | M10 | HEADER | 45 |
| HD-07 | M8 | FORMER | 140 |
| HD-7A | M8 | FORMER | 140 |
| HD-08 | M8 | HEADER | 55 |
| HD-8A | M8 | HEADER | 55 |
| HD-09 | M6 | HEADER | 70 |
| HD-9A | M8 | FORMER | 115 |
| HD-9B | M6 | FORMER | 280 |
| HD-10 | M6 | HEADER | 100 |
| HD-11 | M6 | HEADER | 110 |
| HD-12 | M6 | HEADER | 110 |
| HD-13 | M6 | HEADER | 110 |
| HD-14 | M6 | HEADER | 110 |
| HD-15 đến HD-31 (17 máy) | M4 | HEADER | 180 |
| HD-50 đến HD-52 (3 máy) | M3 | HEADER | 180 |
| HD-53 đến HD-55 (3 máy) | M3 | HEADER | 180 |

### 6.2. Thiết bị RL (32 máy — 25 RL + 7 SM)

| Mã máy | Quy cách | Loại | RPM |
|---|---|---|---|
| RL-02 | M12 | ROLLING | 80 |
| RL-03 | M10 | ROLLING | 102 |
| RL-04 | M8 | ROLLING | 140 |
| RL-05 đến RL-08 (4 máy) | M6 | ROLLING | 140 |
| RL-09 đến RL-14 (6 máy) | M4 | ROLLING (T/S-1) | 215 |
| RL-15 đến RL-23 (9 máy) | M4 | ROLLING | 215 |
| RL-40 đến RL-42 (3 máy) | M3 | ROLLING | 350 |
| SM-01 | M12 | SEM ROLLING | 100 |
| SM-02 | M8 | SEM ROLLING | 110 |
| SM-2A | M8 | SEM ROLLING | 110 |
| SM-03 | M6 | SEM ROLLING | 140 |
| SM-04 | M4 | SEM ROLLING | 210 |
| SM-05 | M4 | SEM ROLLING | 210 |
| SM-06 | M3 | SEM ROLLING | 210 |

### 6.3. Thiết bị CT (Cutting) — thuộc bộ phận RL
- CT-01 đến CT-06 (6 máy), M3-M6, RPM 215
- CT và SM đều phân loại thuộc bộ phận RL (không phải bộ phận riêng)

## 7. LUỒNG NGHIỆP VỤ

### 7.1. Luồng tổ trưởng (điện thoại)

```
[Tap] "Đăng ký tăng ca"
   ↓
Bộ phận (tự động theo tài khoản): HD hoặc RL
   ↓
Chọn loại ngày:
   • Ngày thường → mặc định 16h30-19h30 = 2.5 giờ
   • Chủ nhật    → mặc định 6h00-14h00 = 8 giờ
   ↓
Chọn nhân viên (nhiều người trong 1 phiếu)
   ↓
Với mỗi nhân viên:
   Chọn thiết bị (có thể chọn nhiều máy cho 1 người → gộp ô)
   ↓
   Chọn mã hàng (từ kế hoạch SX ngày hôm đó,
                 chỉ hiện mã đang chạy trên máy đã chọn)
   ↓
   SL dự kiến tự tính = RPM × 60 × duration_hours
   ↓
[Submit] → phiếu gửi lên admin real-time
```

### 7.2. Luồng admin (máy tính)

```
Sáng: Upload file kế hoạch SX ngày hôm đó (.xlsx)
   ↓
App parse sheet ngày hiện tại, lưu vào daily_plans
   ↓
Trong ngày: dashboard hiện phiếu tăng ca real-time
   ↓
Bấm "In phiếu" → xuất file .xlsx đúng format mẫu → in giấy
```

## 8. MAP SỐ MÁY TRONG FILE KẾ HOẠCH

File kế hoạch (Q401-02) có cột A "M/C" ghi tắt:
- "1" = HD-01
- "7A" = HD-7A
- "9,10" = HD-9 + HD-10 (chung sản phẩm)
- "15~31" = HD-15 đến HD-31

Các cột sheet ngày (ví dụ sheet "03.11"):
| Cột | Nội dung |
|---|---|
| A | M/C (số máy rút gọn) |
| B | Item Code |
| C | Item (tên sản phẩm) |
| D | Spec |
| E | Waiting H/D |
| F | Work time |
| G | Planning production |
| H | Production performance |
| I | Staff |
| J | Remark |

## 9. PHIẾU TĂNG CA — FORMAT XUẤT RA

File Excel xuất ra phải giống file mẫu `PHIẾU_ĐĂNG_KÝ_TĂNG_CA.xlsx`:
- Tiêu đề: **PHIẾU ĐĂNG KÝ TĂNG CA / OVERTIME REGISTRATION FORM**
- Người yêu cầu: **HOÀNG CHÍNH HỮU**
- Bộ phận: HD hoặc RL
- Bảng chi tiết gồm: STT, Họ tên, Thời gian đăng ký (Từ-Đến, Số giờ), Thời gian thực tế (Giờ kết thúc, Số giờ), Thiết bị, Mã hàng, SL kế hoạch, SL thực tế, Tỉ lệ, Ghi chú
- Nhân viên đứng nhiều thiết bị → **gộp ô theo nhân viên**
- Ghi chú cuối phiếu: "Lưu ý: Đề nghị viết phiếu tăng ca và nộp cho phòng Nhân sự trước 14h30 trước khi tăng ca. Trường hợp tăng ca trước và nộp đơn sau thì sẽ không được tính tiền tăng ca của ngày đó."

## 10. DATABASE SCHEMA (Supabase)

### `users`
- id (uuid, pk)
- username (text, unique)
- full_name (text)
- role (text) — 'admin' | 'leader'
- department (text, nullable) — 'HD' | 'RL'
- password_hash (text)
- created_at (timestamp)

### `employees`
- id (uuid, pk)
- full_name (text)
- department (text) — 'HD' | 'RL'
- order_no (int)

### `equipments`
- id (uuid, pk)
- code (text, unique) — HD-01, RL-02...
- department (text) — 'HD' | 'RL'
- spec (text)
- machine_type (text) — FORMER, HEADER, ROLLING, SEM ROLLING, CUTTING
- rpm (int)

### `daily_plans`
- id (uuid, pk)
- plan_date (date)
- equipment_code (text) — đã tách từ cột M/C (VD: "9,10" → 2 records: HD-09, HD-10)
- item_code (text)
- item_name (text)
- spec (text)
- staff_name (text)
- uploaded_at (timestamp)

### `overtime_registrations` (header phiếu)
- id (uuid, pk)
- department (text) — 'HD' | 'RL'
- registered_by (uuid, fk → users)
- overtime_date (date)
- day_type (text) — 'weekday' | 'sunday'
- time_from (time)
- time_to (time)
- duration_hours (numeric) — 2.5 hoặc 8
- status (text) — 'pending' | 'printed'
- created_at (timestamp)

### `overtime_items` (chi tiết từng dòng)
- id (uuid, pk)
- registration_id (uuid, fk → overtime_registrations)
- employee_id (uuid, fk → employees)
- equipment_id (uuid, fk → equipments)
- item_code (text)
- item_name (text)
- planned_quantity (int) — RPM × 60 × duration_hours
- actual_quantity (int, nullable)
- note (text, nullable)

## 11. CẤU TRÚC THƯ MỤC

```
hansungbolt-overtime/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # Redirect login/dashboard theo role
│   ├── login/page.tsx
│   ├── register/page.tsx     # Form đăng ký tăng ca (tổ trưởng)
│   ├── dashboard/
│   │   ├── page.tsx          # Dashboard admin
│   │   └── upload/page.tsx   # Upload kế hoạch SX
│   └── api/
│       ├── auth/route.ts
│       ├── registrations/route.ts
│       ├── upload-plan/route.ts
│       └── export/[id]/route.ts
├── components/
│   ├── ui/                   # shadcn/ui
│   ├── OvertimeForm.tsx
│   └── Dashboard.tsx
├── lib/
│   ├── supabase.ts
│   ├── excel-export.ts
│   └── excel-import.ts
├── data/
│   ├── employees.ts
│   └── equipments.ts
├── .env.local                # Supabase keys
├── package.json
└── PROJECT.md
```

## 12. RÀNG BUỘC

- Tiếng Việt là ngôn ngữ chính (UI, thông báo, lỗi).
- Mobile-first (tổ trưởng dùng điện thoại).
- Tối ưu cho tổ trưởng thao tác nhanh — form càng ít bước càng tốt.
- Mỗi bộ phận chỉ thấy data bộ phận mình (Row Level Security Supabase).
- Mật khẩu hash bcrypt, không lưu plaintext.
- Không dùng localStorage cho data nhạy cảm.

## 13. GIAI ĐOẠN TRIỂN KHAI

- **Phase 1 (hiện tại):** Setup môi trường, khởi tạo Next.js, kết nối Supabase.
- **Phase 2:** Tạo database schema + seed data cứng (employees, equipments).
- **Phase 3:** Trang login + dashboard admin cơ bản.
- **Phase 4:** Form đăng ký tăng ca cho tổ trưởng (mobile-first).
- **Phase 5:** Upload file kế hoạch SX + parse Excel.
- **Phase 6:** Xuất phiếu Excel đúng format mẫu.
- **Phase 7:** Test end-to-end, chạy local hoàn chỉnh.
- **Phase 8 (sau):** Deploy Vercel, cấp link cho tổ trưởng.

## 14. QUY TẮC BẢO TRÌ FILE NÀY

File PROJECT.md này là **nguồn tham chiếu duy nhất** cho dự án.

Mỗi khi có thay đổi về:
- Cấu trúc dự án, thư mục, file
- Nhân viên, tổ trưởng, tài khoản
- Thiết bị, RPM, công thức tính
- Luồng nghiệp vụ, database schema
- Stack công nghệ, thư viện

→ Claude Code sau khi làm xong thay đổi **và có yêu cầu từ user** mới được phép cập nhật file MD này. File này phải luôn đồng bộ với code thực tế.

Claude Code **không được tự ý** sửa đổi file PROJECT.md khi user chưa yêu cầu rõ ràng.
