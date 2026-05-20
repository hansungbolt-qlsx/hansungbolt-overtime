# Hansungbolt Overtime — Project Context for Claude

> File này tự nạp vào ngữ cảnh mỗi phiên Claude Code (qua `CLAUDE.md → @PROJECT_CONTEXT.md`).
> Mục đích: giúp Claude ở máy mới (hoặc session mới) nắm ngay bối cảnh dự án, không cần user kể lại từ đầu. Ghi chép bằng tiếng Việt vì toàn bộ giao tiếp với user dùng tiếng Việt.

---

## 1. TL;DR

- Ứng dụng nội bộ đăng ký tăng ca cho nhà máy **Hansungbolt Vietnam** (~26 user).
- Stack: **Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Storage) · JWT auth** (jose + bcryptjs, KHÔNG dùng Supabase Auth).
- Vercel **auto-deploy**: mỗi `git push origin main` → build & deploy ~1-2 phút.
- Commit message bắt đầu `auto: deploy update` (Vercel hook nhận diện) + dòng mô tả tiếng Việt.
- Module "phụ" gần đây: **Bé Học** (game học toán + 20 truyện cổ tích) cho bé 4 tuổi của user — gate chặt `username === 'qlsx'`.

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
- `admin` — chỉ duy nhất `qlsx`. Vào `/dashboard`. Toàn quyền + thấy Bé Học.
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
- **Admin Sửa phiếu** (`/dashboard/registrations/[id]/edit`): per-row giờ Từ/Đến, đổi NV/máy/mã hàng/xóa dòng. **Diff-based update** (KHÔNG xóa-rồi-insert toàn bộ — bài học từ sự cố mất data).
- **Phiếu in A4 dọc** — **RÀNG BUỘC CỨNG: phải fit đúng 1 trang**. Font Arial. Math các mm đã ghi trong comment file `app/dashboard/registrations/[id]/view/page.tsx`. Gộp máy theo nhóm:
  - HD-15..31 → `HD-M4 (NEA)`; HD-50..55 → `HD-M3 (NEA)`.
  - RL-09..23 → `RL-M4` (RL-24 KHÔNG gộp); RL-40..42 → `RL-M3`.
- **Tổng hợp giờ tháng** → in A4 ngang (font Arial). Tính theo `duration_hours` thực tế (admin có thể sửa per-row), không hardcode 3h/8h.

### 4.2. Tem NVL (HD)
- HD leader + worker upload ảnh tem từ điện thoại.
- Server-side: **auto-rotate dọc → ngang** (theo EXIF + check dimensions). KHÔNG auto-crop (đã xóa code cũ vì làm méo ảnh).
- In: 8 tem/trang A4 dọc, ô landscape ~105×74mm, dùng `object-fit: contain` (giữ tỷ lệ, không méo).
- **Cron 01:00 VN** tự xóa tem có `label_date < today` (giữ lại ngày hiện tại).

### 4.3. Tăng ca hôm nay
- Tab/card cross-department cho leader + worker + admin. Hiển thị NV + mã máy gọn theo quy tắc gộp M4/M3.
- Component: `components/TodayOvertimeCard.tsx`. API: `/api/registrations/today-summary`.

### 4.4. Bé Học (game cho bé 4 tuổi — gate `qlsx`)
- Route: `/games` (GameHub) + `/games/<game-id>` cho từng game.
- **7 game**: Đếm số · Nghe & chọn số · Nhiều/Ít · Số lớn/bé · Tìm cái khác · Gom nhóm giống · Kể chuyện.
- **20 truyện cổ tích** (15 VN + 5 thế giới động vật), bản dài 9-12 trang/truyện. Không TTS cho truyện — bố mẹ đọc.
- Sao lưu vào Supabase bảng `game_progress` (biệt lập, không FK, không CASCADE).
- Settings ⚙️: bật/tắt giọng vi-VN, âm lượng, xóa sao.
- Hook tái dùng: `usePointerDrag`, `useGameProgress`. Bộ SVG ghép cảnh: `components/games/story/Scenery.tsx`.

## 5. DB schema & migrations

Migrations đã chạy (tất cả thuần additive — `IF NOT EXISTS`):
1. `01-schema.sql` — gốc (users, employees, equipments, daily_plans, overtime_registrations, overtime_items)
2. `02-material-labels.sql` — material_label_photos
3. `03-employee-name.sql`
4. `04-multi-user.sql` — role worker, seed 25 user
5. `05-simple-password.sql` — password_plain, reset password = `hd123`
6. `06-per-item-times.sql` — time_from/to/duration per item (cho admin sửa per-row)
7. `07-game-progress.sql` — Bé Học (biệt lập, không liên quan dữ liệu sản xuất)

Bảng `equipments` hiện ~84 rows (42 HD + 38 RL + RL-24 + HD-1A + có thể có CVK-HD/CVK-RL từ Công việc khác).

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

### 7.4. Giọng kể truyện Bé Học
Khi viết/sửa text truyện: rút gọn giữ cốt + logic, giữ tình huống gây cấn, **giữ thoại trực tiếp** (tình cảm + đanh của phản diện) để ba mẹ nhập vai; văn phong chân thực cho bé 4 tuổi; pha chút hài; mở đầu **"Ngày xửa ngày xưa, ở..."**. Nhân vật phản diện (Sói, chằn tinh…) bị hù/bỏ chạy, KHÔNG có cảnh giết chóc/mắm.

### 7.5. Self-verify
User explicitly yêu cầu Claude tự đối chiếu trước khi báo xong: spelling, lệch cột, A4 fit, mã máy đúng, v.v. Đừng để user phải chỉ ra lỗi cơ bản.

## 8. File quan trọng (where to find)

- `middleware.ts` — gate routes (qlsx-only cho `/games`, admin-only cho `/dashboard` non-registrations)
- `lib/auth.ts`, `lib/auth-server.ts` — JWT session
- `lib/supabase.ts` — Supabase admin client (service role)
- `lib/parse-plan.ts` — parse Excel kế hoạch sản xuất
- `lib/games/usePointerDrag.ts`, `lib/games/useGameProgress.ts`, `lib/games/vi.ts` — Bé Học shared hooks/helpers
- `components/games/story/Scenery.tsx` — bộ mảnh SVG ghép cảnh truyện
- `lib/games/storyData.ts` — 20 truyện (text + scene composition)
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
- Bé Học: **tablet Android 9 inch** (landscape), bé tự chơi.
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

## 12. Trạng thái khi handoff (cuối session 2026-05-19)

- Commit cuối: `11124a3 — bớt lời nói thừa trong Bé Học`.
- Toàn bộ feature đang chạy ổn định production, không có việc dở dang.
- TODO khi tiếp tục: user đọc duyệt nội dung 20 truyện trên app, có thể yêu cầu chỉnh lời văn hoặc tranh từng truyện.

---

*Khi Claude phiên mới đọc file này, hãy chào hỏi ngắn và xác nhận đã nắm context, không cần kể lại toàn bộ. Sẵn sàng tiếp tục theo điều user yêu cầu.*
