-- ============================================================
-- Migration 21 — Nới CHECK part cho `nvl_khsx` (30/07/2026)
--
-- Cảnh báo xuất NVL ngoài KHSX: agent đẩy thêm part `nvl_khsx` (mã NVL trong
-- KHSX hôm nay) vào nvl_stock_snapshot, nhưng bảng có CHECK chỉ cho 4 part cũ
-- → HTTP 500 (bắt được khi E2E). Nới danh sách. Chạy lại lần nữa vô hại.
-- ============================================================

alter table nvl_stock_snapshot
  drop constraint if exists nvl_stock_snapshot_part_check;

alter table nvl_stock_snapshot
  add constraint nvl_stock_snapshot_part_check
  check (part in ('nvl_main', 'nvl_line', 'nvl_master', 'aux', 'nvl_khsx'));

-- Thử ngay (phải trả về 1 dòng định nghĩa có nvl_khsx):
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conname = 'nvl_stock_snapshot_part_check';
