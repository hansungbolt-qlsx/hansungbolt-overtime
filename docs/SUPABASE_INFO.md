# Supabase Project Info — Hansungbolt Overtime

**Thông tin KHÔNG bí mật** của Supabase project. File này an toàn, có thể commit lên GitHub.

## Project identifier

| Mục | Giá trị |
|---|---|
| Organization | QLSX |
| Project name | QLSX Project |
| Project ID | `rpkvxdetmvpjeiaijesn` |
| Project URL | `https://rpkvxdetmvpjeiaijesn.supabase.co` |
| Region | Southeast Asia (Singapore) — `ap-southeast-1` |
| Database plan | Free ($0/month) — `t4g.nano` |
| Database engine | PostgreSQL |
| Dashboard | https://supabase.com/dashboard/project/rpkvxdetmvpjeiaijesn |

## Quyết định cấu hình ban đầu

- **Enable Data API**: ✅ bật (để web app gọi qua REST)
- **Enable automatic RLS**: ❌ tắt — sẽ bật RLS thủ công từng bảng ở Phase 2
- **Auth**: KHÔNG dùng Supabase Auth native — dùng username + bcrypt tự quản lý trong bảng `users` (quyết định đã chốt ở Phase 1 Q&A)

## API Keys format

Supabase đã chuyển sang naming mới:
- **Publishable key** (`sb_publishable_...`) ↔ tên cũ: `anon public key`
- **Secret key** (`sb_secret_...`) ↔ tên cũ: `service_role key`

Client library `@supabase/supabase-js` hỗ trợ cả 2 format. Dự án này dùng keys mới.

## ⚠️ BÍ MẬT — lưu ở đâu

**KHÔNG** lưu secret vào file này hay bất cứ file nào trong repo. 3 thứ sau chỉ lưu ở:

| Bí mật | Vị trí | Khi nào cần |
|---|---|---|
| Publishable key | `.env.local` → biến `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web app dùng thường xuyên |
| Secret key | `.env.local` → biến `SUPABASE_SERVICE_ROLE_KEY` | Server-side operations (seed, admin) |
| Database password | `docs/supabase-credentials.txt` (local, gitignore) | Kết nối trực tiếp psql/pgAdmin — hiếm dùng |

File `.env.local` đã tự động được `.gitignore` bởi Next.js (không bao giờ đẩy lên GitHub).

## Nếu mất keys

- Publishable / Secret key → vào Dashboard → Settings → API Keys → có thể tạo key mới (rotate), key cũ sẽ invalid
- Database password → vào Dashboard → Settings → Database → Reset password (lưu ý: đổi xong phải update mọi chỗ đang dùng)
