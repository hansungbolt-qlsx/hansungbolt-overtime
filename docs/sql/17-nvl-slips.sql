-- ============================================================
-- Migration 17: Xuất / Trả kho Nguyên phụ liệu từ app tăng ca (28/07/2026)
--
-- Nhân viên kho (role qlsx) ghi phiếu trên điện thoại → agent trên PC đẩy sang
-- APP CHÍNH → phiếu nằm ở "Chờ duyệt" → người duyệt bấm Duyệt thì tồn mới đổi.
-- Supabase ở đây CHỈ là nơi ghi/sửa của điện thoại + hộp thư 2 chiều với agent.
-- TỒN KHO THẬT LUÔN Ở APP CHÍNH — 3 bảng này không bao giờ tự tính tồn.
--
-- Spec: hsb-material-app/docs/SPEC_OT_XUAT_TRA_KHO.md
-- Thuần additive — tạo bảng mới, KHÔNG đụng bảng/dữ liệu cũ.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Phiếu ngày. Mỗi ngày tối đa 4 phiếu tổng:
--    (xuất|trả) × (nguyên liệu|phụ liệu). Trong ngày ghi NHIỀU ĐỢT vào cùng phiếu.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nvl_day_slips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Khoá gửi sang app chính. App chính upsert theo uid → gửi lại = ghi đè.
  uid         text NOT NULL UNIQUE,
  slip_date   date NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('issue', 'return')),
  branch      text NOT NULL CHECK (branch IN ('nvl', 'aux')),
  seq         int  NOT NULL DEFAULT 1,

  -- draft    = 📝 đang ghi trên điện thoại, agent CHƯA gửi
  -- pending  = 📤 đã gửi, đang chờ duyệt bên app chính
  -- approved = ✅ app chính đã duyệt, tồn đã trừ/cộng
  -- rejected = ❌ bị từ chối, xem reject_reason rồi sửa và gửi lại
  status      text NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),

  note        text,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_name text,

  sent_at         timestamptz,   -- lúc agent đẩy sang app chính
  synced_at       timestamptz,   -- lần cuối agent đồng bộ trạng thái về
  reject_reason   text,
  approved_at     timestamptz,
  approved_by     text,

  -- Số phiếu thật app chính sinh ra khi duyệt (có thể 2 phiếu nếu tách bộ phận)
  main_refs   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Lỗi từng dòng app chính trả về ngay khi nhận — hiện đỏ trên điện thoại
  line_errors jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (slip_date, kind, branch, seq)
);

CREATE INDEX IF NOT EXISTS idx_nvl_slips_date   ON nvl_day_slips (slip_date DESC);
CREATE INDEX IF NOT EXISTS idx_nvl_slips_status ON nvl_day_slips (status);

-- ------------------------------------------------------------
-- 2. Dòng phiếu. Nguyên liệu đi theo CUỘN, phụ liệu đi theo SỐ LƯỢNG.
--    Các cột *_snapshot giữ tên/quy cách tại thời điểm ghi để xem lại phiếu cũ
--    vẫn đúng dù master đổi sau này.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nvl_slip_lines (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id   uuid NOT NULL REFERENCES nvl_day_slips(id) ON DELETE CASCADE,
  seq_no    int  NOT NULL DEFAULT 1,

  -- Đợt trong ngày: mỗi lần bấm "Xuất thêm trong ngày" là 1 đợt mới
  batch_seq  int  NOT NULL DEFAULT 1,
  batch_time text,                        -- 'HH:MM' giờ VN
  batch_user text,

  department text NOT NULL DEFAULT 'Heading'
             CHECK (department IN ('Heading', 'Rolling')),

  material_code text NOT NULL,
  material_name text,                     -- snapshot hiển thị
  material_spec text,                     -- size (NVL) hoặc vật liệu·quy cách (PL)

  coil_id  int,                           -- coil.id bên app chính (tick từ tồn đẩy về)
  coil_no  text,
  lot_no   text,

  qty  numeric(14,3) NOT NULL CHECK (qty >= 0),   -- Kg (NVL) hoặc số lượng (PL)
  unit text NOT NULL DEFAULT 'KG',
  note text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nvl_slip_lines_slip ON nvl_slip_lines (slip_id, seq_no);

-- ------------------------------------------------------------
-- 3. Tồn kho app chính đẩy xuống điện thoại — GHI ĐÈ, chỉ giữ bản mới nhất.
--    Tách theo `part` để tiết kiệm egress: phần 'nvl_line' (cuộn đang ở line,
--    chỉ dùng khi TRẢ kho) nặng gấp ~3 lần 'nvl_main'.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nvl_stock_snapshot (
  part      text PRIMARY KEY
            CHECK (part IN ('nvl_main', 'nvl_line', 'nvl_master', 'aux')),
  payload   jsonb NOT NULL,
  n         int   NOT NULL DEFAULT 0,
  pushed_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4. Nhật ký chỉnh sửa — user chốt 28/7: "lịch sử chỉnh sửa lưu ngay tại app
--    tăng ca" (vì người duyệt bên app chính CHỈ XEM, không sửa).
--    Append-only, không bao giờ sửa/xoá dòng đã ghi.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nvl_slip_events (
  id       bigserial PRIMARY KEY,
  slip_id  uuid REFERENCES nvl_day_slips(id) ON DELETE CASCADE,
  slip_uid text NOT NULL,                 -- giữ lại kể cả khi phiếu bị xoá
  at       timestamptz NOT NULL DEFAULT now(),
  actor    text,
  action   text NOT NULL,                 -- save | send | approved | rejected | delete_line
  detail   jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_nvl_slip_events_slip ON nvl_slip_events (slip_id, at DESC);
