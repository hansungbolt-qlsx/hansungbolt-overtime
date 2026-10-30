-- ============================================================
-- Migration 29 — Cảnh báo nhầm nguyên liệu theo KHSX hôm nay (anh Hữu 30/10/2026)
--
-- Vì sao: cùng size dây khác mác thép hay bị lấy nhầm cuộn (nhiều máy cùng size
-- khác mác trong ngày · máy đổi mã cùng size khác mác). App chính tính danh sách
-- lúc đồng bộ KHSX rồi PUT /api/nvl-canh-bao; user HD xem thẻ chữ, tổ trưởng
-- chia sẻ Zalo (ảnh tạo trên điện thoại — KHÔNG lưu ảnh ở đây).
--
-- Mỗi ngày KHSX 1 dòng, đồng bộ lại = ghi đè. Chỉ lưu chữ (JSON ~1–2 KB/ngày).
-- Thuần additive: bảng MỚI, không đụng bảng cũ. Chạy lại lần nữa vô hại.
-- ⚠ Chạy TRƯỚC khi deploy code — nhưng code đã chịu được thiếu bảng (chỉ báo lỗi
--   phần cảnh báo, KHSX vẫn đồng bộ bình thường).
-- ============================================================

create table if not exists nvl_canh_bao (
  plan_date  date primary key,
  built_at   timestamptz not null,
  snap_id    integer,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Chỉ server (service role) đọc/ghi — giống các bảng khác của app
alter table nvl_canh_bao enable row level security;
