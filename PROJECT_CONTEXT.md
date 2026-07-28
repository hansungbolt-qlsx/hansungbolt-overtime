# Hansungbolt Overtime — Project Context for Claude

> File này tự nạp vào ngữ cảnh mỗi phiên Claude Code (qua `CLAUDE.md → @PROJECT_CONTEXT.md`).
> Mục đích: giúp Claude ở máy mới (hoặc session mới) nắm ngay bối cảnh dự án, không cần user kể lại từ đầu. Ghi chép bằng tiếng Việt vì toàn bộ giao tiếp với user dùng tiếng Việt.

---

## 1. TL;DR

- Ứng dụng nội bộ đăng ký tăng ca cho nhà máy **Hansungbolt Vietnam** (~26 user).
- Stack: **Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Storage) · JWT auth** (jose + bcryptjs, KHÔNG dùng Supabase Auth).
- Vercel **auto-deploy**: mỗi `git push origin main` → build & deploy ~1-2 phút.
- Commit message bắt đầu `auto: deploy update` (Vercel hook nhận diện) + dòng mô tả tiếng Việt.

## 2. URLs & resources

- **Prod**: https://hansungbolt-overtime.vercel.app
- **GitHub**: https://github.com/hansungbolt-qlsx/hansungbolt-overtime (branch chính `main`)
- **Supabase project**: https://supabase.com/dashboard/project/rpkvxdetmvpjeiaijesn (Singapore region, Free/Hobby plan)
- **Vercel project**: `hansungbolt-qlsxs-projects/hansungbolt-overtime` (Hobby plan)
- **Env vars** (đã có trên Vercel; máy local cần `.env.local`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT_SECRET`
  - `CRON_SECRET` (cho `/api/labels/cleanup` và `/api/registrations/cleanup`)

## 3. Roles & users

**3 cấp role:**
- `admin` — chỉ duy nhất `qlsx`. Vào `/dashboard`. Toàn quyền + quản lý tài khoản (thêm/reset/xóa).
- `leader` (tổ trưởng) — đăng ký tăng ca cho tổ, xóa phiếu bộ phận mình, upload tem NVL (chỉ HD).
- `worker` (nhân viên) — chỉ xem (không đăng ký), upload tem (HD), xem tổng hợp giờ bộ phận mình.

**Tài khoản:**
- Username = tên không dấu liền (vd `trananhtuan`). Password chung `hd123` cho mọi leader/worker (sau migration 05). Admin có password riêng.
- Cột `password_plain` trong `users` lưu password hiện tại để admin xem được.

**2 bộ phận:**
- **HD** (Heading/dập nguội): 43 máy. 3 leader + 11 worker.
- **RL** (Rolling/cắt ren): 39 máy = 25 RL + 7 SM + 6 CT + RL-24 đặc thù. 3 leader + 8 worker.

## 4. Tính năng đã có (toàn bộ đã production)

### 4.1. Đăng ký tăng ca (chính)
- Leader chọn ngày + loại ngày (`weekday` 16:30–19:30 / `sunday` 06:00–14:00), chọn NV + máy + mã hàng → tính SL dự kiến `RPM × 60 × giờ_tính`.
- HD: lấy mã hàng từ `daily_plans` (admin upload Excel Q401-02 hàng ngày).
- RL: nhập mã hàng **tay** (không có plan upload). Số lượng tự tính theo RPM.
- "Công việc khác" (nút cam cuối danh sách máy): nhập mô tả tự do, không tính SL. Tạo equipment row `CVK-<dept>` lần đầu submit (auto-ensure).
- **Mặc định ẩn form NV** cho đến khi user click chọn loại ngày (giảm diện tích trang). Lưới máy giới hạn `max-h-[220px]` (hiện ~8 ô), scroll trong panel để xem thêm.
- **Màu chữ mã máy theo prefix** để dễ phân biệt: HD navy, RL xanh lá, SM tím, CT đỏ.
- **Leader sửa phiếu** (`/dashboard/registrations/[id]/edit` cho leader cùng dept) — dùng `LeaderEditForm` mobile-friendly (UI giống lúc đăng ký mới). PATCH endpoint accept payload đơn giản (không cần per-row time).
- **Admin Sửa phiếu** — dùng `EditRegistrationForm` (giữ chức năng sửa giờ thực tế per-row cho lương). **Diff-based update** (KHÔNG xóa-rồi-insert toàn bộ — bài học từ sự cố mất data).
- **Phiếu in A4 dọc** — **RÀNG BUỘC CỨNG: phải fit đúng 1 trang**. Font Arial. Math các mm đã ghi trong comment file `app/dashboard/registrations/[id]/view/page.tsx`. Gộp máy theo nhóm:
  - HD-15..31 → `HD-M4 (NEA)`; HD-50..55 → `HD-M3 (NEA)`.
  - RL-09..23 → `RL-M4` (RL-24 KHÔNG gộp); RL-40..42 → `RL-M3`.
- **Người yêu cầu trong phiếu in** = tên user đã `registered_by` (không hardcode). NV chỉ có CVK → xếp cuối phiếu in.
- **Tổng hợp giờ tháng** → admin có 2 tab HD/RL + nút Xem (preview web) cạnh nút In/Xuất. In A4 ngang, font Arial. Tính theo `duration_hours` thực tế.

### 4.2. Tem NVL (HD)
- HD leader + worker upload ảnh tem từ điện thoại.
- Server-side: **auto-rotate dọc → ngang** (theo EXIF + check dimensions). KHÔNG auto-crop (đã xóa code cũ vì làm méo ảnh).
- In: 8 tem/trang A4 dọc, ô landscape ~105×74mm, dùng `object-fit: contain` (giữ tỷ lệ, không méo).
- **Cron 01:00 VN** tự xóa tem có `label_date < today` (giữ lại ngày hiện tại).

### 4.3. Tăng ca hôm nay
- Card cho leader + worker (chỉ thấy dept mình) + admin (thấy cả HD/RL). Hiển thị list NV với chi tiết từng máy (KHÔNG gộp M4/M3 — gộp chỉ áp dụng cho phiếu in).
- **Nút Chia sẻ** chụp card thành PNG (`html-to-image`, off-screen "share view" 480px inline-styles để render ổn định) → Web Share API gửi lên Zalo/Messenger với ảnh đẹp như app. Fallback: tải PNG xuống máy.
- Component: `components/TodayOvertimeCard.tsx`. API: `/api/registrations/today-summary`.

### 4.4. Quản lý tài khoản (admin)
- `/dashboard/users` — admin thêm tài khoản / reset password / soft-delete (Đã nghỉ).
- **Thêm NV mới**: họ tên + username + bộ phận (HD/RL) + role (worker/leader). Password mặc định `hd123`. Insert cùng lúc `users` + `employees` (reactivate nếu đã có employee inactive cùng tên).
- **Đã nghỉ** (toggle, không hard-delete): set `users.active=false` + `employees.active=false` + `deactivated_at=now()`. NV không login được + không hiện trong dropdown đăng ký tăng ca. Trong list, NV đã nghỉ mờ đi + xếp cuối + hiển thị ngày nghỉ. Nút "Khôi phục" để undo. Phiếu cũ vẫn join được với NV đã nghỉ (FK an toàn).
- **Click logo** ở bất kỳ trang nào → về trang chủ (admin → `/dashboard`, leader/worker → `/register`).

### 4.5. Tăng ca QLSX (admin)
- Tab `/dashboard/qlsx` riêng cho khối quản lý sản xuất (5 NV cố định: Hoàng Chính Hữu, Lê Đức Minh, Phạm Văn Cường, Nguyễn Thị Giang, Nguyễn Âu Thu Nguyệt).
- Form giống HD/RL **nhưng không có máy** — mỗi NV chỉ chọn tên + textarea **"Lý do tăng ca"**.
- Người yêu cầu mặc định = admin đăng nhập.
- Backend: POST `/api/registrations/qlsx`, auto-create equipment `CVK-QLSX` lần đầu, lưu lý do vào `item_code`.

### 4.6. Kế hoạch đã tải lên (admin)
- Card trong `/dashboard` Tổng quan (col-span-2, gộp với "Kế hoạch sản xuất"). Giữ 3 file Excel gốc gần nhất, tải về giữ nguyên định dạng.
- Bucket Supabase Storage `plan-files` auto-tạo lần upload đầu. Metadata trong bảng `plan_files`. Re-upload cùng ngày replace file cũ; upload ngày thứ 4 → cleanup file cũ nhất.
- Nút Upload có drag-and-drop bypass Windows "file in use" lock.

### 4.7. Print server remote (tất cả role)
- Kiến trúc: điện thoại 4G → Vercel (queue job) → máy tính admin chạy agent Node.js poll job → puppeteer render PDF → in ApeosPort-VI C4471 qua LAN.
- Bảng `print_jobs` (id, type, ref_id, requested_by, status). Type: `registration` / `labels_day` / `overtime_summary`.
- `AGENT_SECRET` env var Vercel. Agent login bằng tài khoản `qlsx` (mật khẩu lấy ở `print-agent/.env` — không ghi giá trị vào tài liệu) để có session render view page.
- Nhận lệnh in CẢ NGÀY (bỏ chặn giờ 22/7 — PC in tắt thì job hết TTL, nút In tự cảnh báo). API validate quyền: leader chỉ in dept mình; leader HD mới in tem.
- Folder `print-agent/` trong repo: `agent.js` + `install.bat` + `start.bat` + `README.md`. User đã cài trên máy admin.
- Nút "In phiếu" (registration + overtime_summary) và "In tem" (labels_day) hiện cho leader/worker. Admin có thêm nút Xem + In/Xuất browser trong tổng hợp giờ.
- Danh sách phiếu tăng ca auto refetch khi OvertimeForm submit (custom event `overtime:registered`).

## 5. DB schema & migrations

Migrations đã chạy (tất cả thuần additive — `IF NOT EXISTS` hoặc DROP + ADD CONSTRAINT):
1. `01-schema.sql` — gốc (users, employees, equipments, daily_plans, overtime_registrations, overtime_items)
2. `02-material-labels.sql` — material_label_photos
3. `03-employee-name.sql`
4. `04-multi-user.sql` — role worker, seed 25 user
5. `05-simple-password.sql` — password_plain, reset password = `hd123`
6. `06-per-item-times.sql` — time_from/to/duration per item (cho admin sửa per-row)
7. `07-game-progress.sql` — (Bé Học cũ — đã gỡ khỏi code, bảng `game_progress` vẫn còn trên Supabase để tham khảo lịch sử, không dùng đến)
8. `08-employee-active.sql` — soft delete: `active boolean default true` + `deactivated_at timestamptz` cho cả `users` lẫn `employees`. Toggle "Đã nghỉ" trong /dashboard/users.
9. `09-qlsx-department.sql` — mở rộng CHECK constraint của 4 bảng để chấp nhận `QLSX`, seed 5 NV QLSX vào employees.
10. `10-plan-files.sql` — bảng `plan_files` lưu metadata file Excel kế hoạch đã upload (giữ 3 file gần nhất trong Supabase Storage `plan-files`).
11. `11-print-jobs.sql` — bảng `print_jobs` queue lệnh in cho agent Node.js.
12. `12-print-jobs-overtime-summary.sql` — mở rộng CHECK constraint `print_jobs.type` thêm `overtime_summary`.
13. `13-print-jobs-khsx-dccd.sql` · `14-print-jobs-overtime-sheets.sql` — mở rộng thêm type in.
14. `15-machine-stop-reasons.sql` · `16-stop-reasons-st-dismissed.sql` — máy dừng.
15. **`17-nvl-slips.sql` (28/07/2026)** — Xuất / Trả kho nguyên phụ liệu:
    `nvl_day_slips` (phiếu ngày, `uid` unique = khoá gửi app chính) ·
    `nvl_slip_lines` (dòng, có cuộn/lot cho NVL) ·
    `nvl_stock_snapshot` (tồn app chính đẩy xuống, ghi đè theo `part`) ·
    `nvl_slip_events` (nhật ký sửa — vì bên app chính người duyệt CHỈ XEM).
    ⚠ Phải chạy trên Supabase SQL Editor TRƯỚC khi dùng 2 tab Xuất/Trả kho.

Bảng `equipments` hiện ~84 rows (42 HD + 38 RL + RL-24 + HD-1A + có thể có CVK-HD/CVK-RL từ Công việc khác).

## 5b. Xuất / Trả kho nguyên phụ liệu (28/07/2026)

Nhân viên kho (`phamvancuong`, role `qlsx`) ghi phiếu trên điện thoại → agent trên PC
đẩy sang **app chính** → phiếu nằm ở "Chờ duyệt" → người duyệt bấm Duyệt thì tồn mới đổi.

**App chính là CHỦ KHO DUY NHẤT** — app này không bao giờ tự trừ/cộng tồn.

| Thành phần | Chỗ |
|---|---|
| UI điện thoại | `components/WarehouseSlipView.tsx` (1 component cho cả Xuất lẫn Trả) |
| Quét tem | `components/BarcodeScanButton.tsx` — html5-qrcode BUNDLE, **cấm BarcodeDetector** (iOS Safari không có) |
| API điện thoại | `app/api/nvl-slips` (GET/POST) · `app/api/nvl-stock` (GET) |
| API cho agent | `app/api/nvl-slips/sync` (GET lấy phiếu · POST ghi ngược trạng thái) · `app/api/nvl-stock` (POST) |
| Agent | `print-agent/agent.js` → `syncNvlOnce()` mỗi 60s |
| Dùng chung | `lib/nvl-slips.ts` (uid, bộ phận mặc định, kiểu dữ liệu) |
| Spec đầy đủ | app chính: `hsb-material-app/docs/SPEC_OT_XUAT_TRA_KHO.md` |

Quy tắc đã cài: mỗi ngày 1 phiếu tổng / loại / nhánh, ghi nhiều đợt · gửi lại = ghi đè
bản chờ duyệt · đã duyệt rồi thì tự mở phiếu mới · agent **vét 16:15** + sáng bật PC
cho phiếu quên bấm Gửi · chỉ 2 bộ phận Heading/Rolling (dầu 46HS·527V → Heading,
322 → Rolling) · phụ liệu hết tồn thì chặn ngay trên điện thoại.

## 6. Convention quan trọng

- **Ngôn ngữ**: tiếng Việt cho commit message, UI text, lời thoại với user. Reply ngắn gọn, giọng kể chuyện kỹ thuật, không khoe khoang.
- **Commit**: prefix `auto: deploy update\n\n<chi tiết tiếng Việt>`. KHÔNG dùng emoji trừ khi user yêu cầu.
- **Deploy**: `git push origin main` → Vercel auto-build. TUYỆT ĐỐI KHÔNG `git push --force` lên main.
- **A4 1 trang**: phiếu in luôn phải fit 1 trang dọc. Đo lại tổng mm khi sửa column/row height.
- **Self-verify trước khi báo xong**: tự đối chiếu spelling/columns/A4 fit; user kỳ vọng Claude tự kiểm tra (xem mục Bài học).
- **Test workflow**: "vừa làm vừa test" — chia batch nhỏ, push từng đợt rồi báo user test trên app trước khi làm tiếp. Đặc biệt với content (truyện) hay schema (migration).

## 7. BÀI HỌC QUAN TRỌNG (đừng vi phạm)

### 7.1. An toàn dữ liệu sản xuất
Sự cố 21/4/2026: toàn bộ `overtime_registrations` bị mất khi user chạy migration trên Supabase SQL Editor — nghi do trong cùng tab có DELETE query cũ. Free plan KHÔNG có backup → không khôi phục được.

**Quy tắc bắt buộc:**
- Khi đưa SQL cho user chạy: **nhắc kỹ mở "New Query" tab MỚI TRỐNG** trên Supabase Dashboard SQL Editor.
- Migration thuần additive (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Không ALTER/DROP/DELETE bảng cũ.
- Destructive ops trong API: scope theo PK cụ thể (`.eq('id', x)`), KHÔNG dùng `.delete().eq('foreign_key_id', x)` blast radius rộng. Diff-based update.
- Supabase Free plan KHÔNG có backup — nói thẳng với user, đừng hứa khôi phục được.

### 7.2. Vercel Cron
2 cron job đã setup, chạy được khi:
1. Có env var `CRON_SECRET` trên Vercel (đã tạo).
2. Middleware **exclude** path `/api/labels/cleanup` và `/api/registrations/cleanup` (đã làm — kiểm tra `middleware.ts`).

Test cron thủ công bằng curl: `curl -H "Authorization: Bearer $CRON_SECRET" https://hansungbolt-overtime.vercel.app/api/labels/cleanup`.

### 7.3. Image processing
KHÔNG over-engineer image processing. Code cũ `cropLabel` (~140 dòng scan pixel theo màu) nhận diện sai gây méo ảnh → đã xóa. Chỉ giữ rotation đơn giản (EXIF + dimension check).

### 7.4. Self-verify
User explicitly yêu cầu Claude tự đối chiếu trước khi báo xong: spelling, lệch cột, A4 fit, mã máy đúng, v.v. Đừng để user phải chỉ ra lỗi cơ bản.

## 8. File quan trọng (where to find)

- `middleware.ts` — gate routes (admin-only cho `/dashboard` non-registrations)
- `lib/auth.ts`, `lib/auth-server.ts` — JWT session
- `lib/supabase.ts` — Supabase admin client (service role)
- `lib/parse-plan.ts` — parse Excel kế hoạch sản xuất
- `docs/sql/` — toàn bộ migrations đã chạy
- `scripts/seed-reference-data.ts` — seed reference data (chạy 1 lần lúc đầu, KHÔNG chạy lại)

## 9. Test credentials

- **Admin**: `qlsx` / password riêng (xem `users.password_plain` trên Supabase nếu cần)
- **Leader HD**: `trananhtuan` / `hd123`, `phamhuuanh`, `nguyentiendung`
- **Worker HD**: `nguyenxuanquang` / `hd123`, `phamtuanvu`, ...
- **Leader RL**: `buidoantoan` / `hd123`, `nguyenvantung`, `duongduclinh`
- **Worker RL**: `hovanbau` / `hd123`, `vovantrinh`, ...

Full list 25 user: `docs/sql/04-multi-user.sql` và `scripts/seed-reference-data.ts`.

## 10. User testing pattern

- Test chính trên: **iPhone Safari** (mobile-first). Đôi khi Windows Chrome.
- Tem NVL: chụp ảnh từ điện thoại upload.
- User chụp screenshot Windows + paste vào chat khi báo lỗi/đề xuất.

## 11. Setup máy mới

### 11.0. Trước khi mở dự án — cài/đăng nhập các thứ sau trên máy mới
**Cần cài (nếu chưa có):**
- **Node.js** (cùng major với máy cũ — Node 20 LTS trở lên cho Next.js 16). Check máy cũ bằng `node -v` rồi cài bản tương ứng.
- **Git** (Git for Windows). VS Code thường dùng git này luôn.
- **VS Code** (user đã có).
- **Extension Claude Code** trong VS Code.

**Cần đăng nhập (auth KHÔNG transfer theo thư mục):**
- **Claude Code**: login Anthropic account trên VS Code máy mới (auth là per-device).
- **GitHub**: để `git push` chạy được. Cách dễ nhất: trong VS Code mở terminal, lần đầu `git push` sẽ bật pop-up auth. Hoặc cài `gh` CLI rồi `gh auth login`.
- **Browser** (khi cần dùng Dashboard): login lại Supabase Dashboard, Vercel Dashboard, GitHub web UI.

### 11.1. Cách A — copy toàn bộ thư mục (khuyến nghị)
1. Trên máy cũ: **xóa** `node_modules/` và `.next/` để giảm dung lượng.
2. Copy toàn bộ thư mục `c:\hansungbolt-overtime\` (gồm cả file ẩn: `.env.local`, `.git/`, `.claude/`, `PROJECT_CONTEXT.md` này).
3. Trên máy mới:
   ```
   cd hansungbolt-overtime
   npm install
   npm run dev   # test local
   ```
4. Git remote đã trỏ về GitHub — `git push origin main` vẫn deploy được lên Vercel cũ.

### 11.2. Cách B — git clone fresh
1. `git clone https://github.com/hansungbolt-qlsx/hansungbolt-overtime.git`
2. **Tạo lại `.env.local`** (file gitignored, không có trong repo):
   - Lấy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` từ Supabase Dashboard → Project Settings → API.
   - `JWT_SECRET` phải **giống máy cũ** (nếu khác, mọi user phải đăng nhập lại; không vấn đề lớn). Sinh mới bằng `openssl rand -base64 32` nếu muốn.
3. `npm install` rồi `npm run dev`.

### 11.3. Memory của Claude trên máy cũ
Claude máy cũ lưu memory tại `~/.claude/projects/c--hansungbolt-overtime/memory/` (Windows: `C:\Users\<username>\.claude\projects\c--hansungbolt-overtime\memory\`) — nằm NGOÀI thư mục dự án, KHÔNG đi theo khi copy.

- File `PROJECT_CONTEXT.md` này đã tóm tắt mọi context durable Claude cần → không bắt buộc copy memory.
- Nếu muốn giữ nguyên auto-memory: copy thủ công thư mục `memory/` sang đúng đường dẫn tương ứng trên máy mới (`C:\Users\<user-mới>\.claude\projects\c--hansungbolt-overtime\memory\`).

### 11.4. TUYỆT ĐỐI KHÔNG làm các việc sau trên máy mới
- KHÔNG chạy lại `scripts/seed-reference-data.ts` → sẽ trùng/lỗi unique constraint (data đã seed lên Supabase từ lâu).
- KHÔNG chạy lại các migration trong `docs/sql/` lên Supabase (đã chạy hết — chỉ chạy migration MỚI nếu sau này có).
- KHÔNG `git push --force` lên `main`.
- KHÔNG sửa `JWT_SECRET` trong `.env.local` (nếu khác máy cũ thì cookie session cũ vô hiệu, user phải đăng nhập lại — không nguy hiểm nhưng phiền).
- KHÔNG commit file `.env.local` vào git (đã `.gitignore` rồi, nhưng nhắc cẩn thận).

### 11.5. Sau khi setup xong, test theo thứ tự
1. `npm install` không lỗi.
2. `npm run dev` chạy được, mở `http://localhost:3000` thấy trang login.
3. `npx tsc --noEmit` pass (TypeScript check).
4. `npx next build` pass (production build).
5. `git status` clean, `git remote -v` trỏ về `github.com/hansungbolt-qlsx/hansungbolt-overtime`.
6. Sửa nhẹ 1 file vô hại (vd thêm 1 dòng comment), commit + push → quan sát Vercel Dashboard auto-build → deploy success → URL prod vẫn hoạt động.
7. Mở Claude Code trong VS Code, gõ vài câu — kiểm tra Claude đã đọc `PROJECT_CONTEXT.md` (hỏi "bạn còn nhớ dự án không" → nếu trả lời nắm context là OK).

## 12. Trạng thái hiện tại (2026-07-11)

Session lớn — hoàn thiện **print server remote** cho tổ trưởng ở xưởng in qua 4G.

**Đã thêm/sửa (session mới nhất):**
- **Kế hoạch đã tải lên**: card trong Dashboard Tổng quan, giữ 3 file Excel gốc gần nhất trong Supabase Storage `plan-files`. Nút Upload có drag-and-drop bypass Windows "file in use" lock (migration 10).
- **Print server remote** cho tổ trưởng 4G:
  * Bảng `print_jobs` queue (migration 11 + 12).
  * Agent Node.js trong folder `print-agent/` chạy trên máy admin. Login bằng `qlsx` (mật khẩu ở `print-agent/.env`) → puppeteer render PDF → in ApeosPort qua LAN.
  * `AGENT_SECRET=k7hf9x3nB8mp1WQ4Z2yLtG6cVsA5rDe` đã set trên Vercel + `.env` của agent.
  * 3 loại print: `registration` (phiếu tăng ca) / `labels_day` (tem NVL) / `overtime_summary` (tổng hợp giờ, A4 landscape).
  * Nhận lệnh in cả ngày (bỏ chặn giờ 22/7). API validate quyền dept.
  * Nút "In phiếu" / "In tem" cho leader/worker. Admin có thêm Xem + In/Xuất browser.
- **UI mobile-first refactor**:
  * Gộp "Phiếu đã gửi" + "Danh sách phiếu" → 1 card mobile-friendly (card layout, không table).
  * Component `DateButton` hiển thị "Ngày DD/MM/YYYY" chữ N viết hoa (thay browser locale lowercase).
  * `OvertimeForm`: toggle chọn loại ngày (click active → thu gọn form). Time label hiện dưới nút được chọn thay vì dưới cả 2.
  * Custom event `overtime:registered` → DepartmentRegistrationsList auto refetch không cần reload.
- Tổng hợp giờ có thêm tab QLSX + tab "Tất cả" (admin).
- Fix timezone Vercel (UTC → giờ VN cho date display).

**Việc chưa hoàn thành:**
- Phiếu in QLSX có thể vẫn hiển thị cột thiết bị/SL lệch (layout HD/RL). Cần test thử.
- ~~Agent chưa được cài auto-start Windows Task Scheduler~~ — **ĐÃ CÓ** (đính chính 27/07/2026): task `HansungbolPrintAgent` chạy watchdog 5 phút/lần, tự bật lại agent nếu chết. Không phải double-click `start.bat` nữa.

**Lưu ý cho phiên sau:**
- Print agent chạy nền trên máy admin. **⛔ TUYỆT ĐỐI KHÔNG khởi động agent từ phiên Claude Code** (kể cả `run_in_background: true`) — tiến trình con chết theo phiên, agent tắt âm thầm. Cách đúng: `Start-ScheduledTask -TaskName 'HansungbolPrintAgent'` để Task Scheduler làm cha tiến trình. Kiểm tra sống: `print-agent/agent-out.log` phải có `Login OK` + `Catalog DCCD: N chỉ thị`, còn `agent-err.log` rỗng.
- `AGENT_SECRET` là `k7hf9x3nB8mp1WQ4Z2yLtG6cVsA5rDe`. Nếu leak → sinh mới, update Vercel env + agent `.env` + Redeploy Vercel.
- Mật khẩu admin `qlsx`: **KHÔNG ghi giá trị vào tài liệu nữa** (trước ghi `qlsx123`, sau sự cố 25/07 đã lệch thực tế → gây hiểu nhầm). Nguồn duy nhất = `print-agent/.env` (gitignored). Đọc mục "SỰ CỐ 25-27/07" cuối file trước khi đổi mật khẩu này.
- Quy tắc data safety đã củng cố: code phụ thuộc migration phải forward-compat (`SELECT *`). Đã có sự cố commit 9440f0b → hotfix 7919ca6 từ session trước.
- Khi cần chạy migration: viết file `docs/sql/NN-...sql`, gửi user paste vào Supabase Dashboard SQL Editor (nhắc rõ **New Query tab MỚI TRỐNG**). Verify bằng script Node trước khi báo "đã xong".

---

## 🚨 SỰ CỐ 25-27/07/2026 — Reset mật khẩu `qlsx` làm đứt 4 luồng nối app chính

**ĐỌC MỤC NÀY TRƯỚC KHI ĐỘNG VÀO TÀI KHOẢN `qlsx` HOẶC MÀN QUẢN LÝ NHÂN VIÊN.**

### Chuyện gì xảy ra

Ngày 25/07 (sáng, trong lúc làm vai trò QLSX + tạo tài khoản `phamvancuong`), có
người bấm nút **"Reset MK"** trên dòng `qlsx` ở Dashboard → Quản lý nhân viên.
Endpoint `POST /api/users/[id]/reset-password` **luôn** set về hằng số `hd123`.

Vấn đề: **`qlsx` là tài khoản DUY NHẤT chưa bao giờ dùng `hd123`.**
- `scripts/seed-reference-data.ts` tạo nó với mật khẩu khác
- `docs/sql/05-simple-password.sql` reset toàn bộ về `hd123` nhưng có
  `WHERE role <> 'admin'` → **cố tình chừa nó ra**

⇒ Với 25 tài khoản còn lại, nút đó là "khôi phục mặc định" (vô hại — bấm nhầm
cũng không sao). Riêng dòng `qlsx`, nó là "**đổi mật khẩu**".

### Vì sao 1 cú bấm làm sập 4 luồng

`qlsx` không chỉ là tài khoản của người — **2 máy chủ dùng nó để đăng nhập**:

| Nơi giữ mật khẩu | Reset có sửa? | Luồng chết khi lệch |
|---|---|---|
| DB Supabase (app này) | ✔ | — |
| `C:\ProgramData\HSB-Material\overtime_sync.cfg` (app chính) | ✘ | đẩy KHSX sang app này · kéo lý do dừng máy về TV · prefill máy ngưng |
| `C:\hansungbolt-overtime\print-agent\.env` | ✘ | **in phiếu DCCD từ điện thoại** |

### Vì sao ẩn được 2 ngày, triệu chứng lệch nhau

Phiên đăng nhập là **JWT ký sẵn** (`lib/auth.ts`, HS256, 90 ngày), **không có
bảng session trên server** ⇒ đổi mật khẩu **KHÔNG hủy được phiên đang mở**:

- **Poller app chính** login mới mỗi lượt (4 lượt/ngày) → chết ngay 25/07 16:00
- **Print agent** login 1 lần lúc khởi động rồi giữ cookie → vẫn in bình thường
  tới 15:15 ngày 25/07, chỉ chết sáng 27/07 khi PC reboot buộc login lại
- **Người dùng** (tổ trưởng, điện thoại): **không ai bị đá ra, không ai thấy gì**

Không có bảng audit nào trong 14 bảng Supabase, log Vercel/Supabase gói Free chỉ
giữ ~1 ngày ⇒ **không truy được ai bấm, lúc nào**.

### Chẩn đoán nhanh lần sau

1. `POST /api/auth/login` bằng cfg → **401** = sai mật khẩu · **403** = tài khoản bị khoá
2. `users.password_plain` của `qlsx` = `hd123` ⇒ đã bị Reset MK
3. `machine_stop_reasons` không có dòng `created_by_name='KHSX tự động'` hôm nay
   ⇒ prefill chết ⇒ cầu nối đứt
4. `print-agent/agent-err.log` → `Login failed HTTP 401`

### Quy tắc bắt buộc

**Đổi mật khẩu `qlsx` = phải sửa ĐỦ 2 file cfg + khởi động lại print agent**
(`Start-ScheduledTask -TaskName 'HansungbolPrintAgent'`). Sửa `overtime_sync.cfg`
có tác dụng ngay (app chính đọc lại mỗi lần gọi); sửa `.env` thì **bắt buộc**
khởi động lại agent. Quét toàn máy 27/07 xác nhận chỉ 2 chỗ đó giữ mật khẩu sống.

### Lỗ hổng chưa vá (user biết, chưa ưu tiên)

| | Vấn đề | Đề xuất |
|---|---|---|
| 1 | Nút "Reset MK" **cố ý bật cho cả dòng admin** (`UserManagementCard.tsx`: `u.role === 'admin' \|\| !inactive`), và nhóm QLSX nằm ngay dưới nhóm Admin nên 2 nút sát nhau | Tách tài khoản service `svc-appchinh` (role admin, ẩn khỏi lưới nhân viên, không có nút Reset) → `qlsx` trở lại thuần tài khoản người |
| 2 | Cột `users.password_plain` lưu mật khẩu chữ thường | Bỏ, hoặc chỉ hiện cho admin qua endpoint riêng |
| 3 | Bảng `users` không có `updated_at`, không có bảng nhật ký thao tác tài khoản | Thêm để lần sau truy được ai/lúc nào |
| 4 | App chính không có báo động khi cầu nối 401 — chỉ ghi 1 dòng `log.warning` | Telegram khi sync trả `ok=False` |

**Trạng thái 27/07:** cả 3 nơi đã đồng bộ `hd123`, 4 luồng chạy lại bình thường.
User chốt **giữ nguyên `hd123`** — hệ quả tích cực: bấm nhầm Reset MK lên `qlsx`
giờ vô hại (hd123 → hd123); đánh đổi: admin dùng mật khẩu mặc định ai cũng biết.

---

*Khi Claude phiên mới đọc file này, hãy chào hỏi ngắn và xác nhận đã nắm context, không cần kể lại toàn bộ. Sẵn sàng tiếp tục theo điều user yêu cầu.*
