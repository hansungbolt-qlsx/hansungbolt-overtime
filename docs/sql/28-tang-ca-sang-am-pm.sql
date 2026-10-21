-- ============================================================
-- Migration 28 — Tăng ca SÁNG (AM) / CHIỀU (PM) (anh Hữu 21/10/2026)
--
-- Vì sao: ngày thường có thêm tăng ca sáng 06:00–07:30. Một bộ phận một ngày
-- có thể có 2 phiếu: AM + PM, in 2 tờ riêng. Giờ công một người = giờ ca AM
-- + giờ ca PM (trước đây lấy MAX theo ngày → sẽ mất 1,5h).
--
-- ⚠ CHẠY FILE NÀY TRƯỚC khi deploy code app tăng ca bản AM/PM — code mới
--   đọc/ghi cột `shift`, thiếu cột là trang đăng ký lỗi.
--
-- Thuần additive: thêm cột có DEFAULT 'PM' → mọi phiếu cũ tự là PM, giờ công
-- không đổi. Chủ nhật luôn là 'PM' (không chia ca).
-- Chạy lại lần nữa vô hại.
-- ============================================================

-- 1. Cột ca
alter table overtime_registrations
  add column if not exists shift text not null default 'PM';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'overtime_registrations_shift_check'
  ) then
    alter table overtime_registrations
      add constraint overtime_registrations_shift_check check (shift in ('AM', 'PM'));
  end if;
end $$;

-- 2. Hai phiếu tăng ca sáng QLSX đã có (anh Hữu đồng ý gắn AM 21/10/2026):
--    26/09/2026 và 10/10/2026, 06:00–07:30, 1,5 giờ.
update overtime_registrations
   set shift = 'AM'
 where department = 'QLSX'
   and day_type = 'weekday'
   and overtime_date in ('2026-09-26', '2026-10-10')
   and time_from = '06:00:00'
   and time_to = '07:30:00';

-- 3. Vân tay v3 = v2 + cột shift (đổi ca phải kích hoạt đồng bộ sang app chính)
create or replace function overtime_fingerprint()
returns text
language sql
stable
as $$
  select md5(coalesce(string_agg(t.row_txt, '|' order by t.row_txt), 'empty'))
  from (
    select 'r:' || r.id::text
        || ':' || r.overtime_date::text
        || ':' || r.department
        || ':' || r.day_type
        || ':' || coalesce(r.duration_hours::text, '')
        || ':' || coalesce(r.time_from::text, '')
        || ':' || coalesce(r.time_to::text, '')
        || ':' || coalesce(r.shift, '')
      as row_txt
    from overtime_registrations r
    union all
    select 'i:' || i.id::text
        || ':' || i.registration_id::text
        || ':' || i.employee_id::text
        || ':' || coalesce(i.duration_hours::text, '')
        || ':' || coalesce(i.equipment_id::text, '')
        || ':' || coalesce(i.item_code, '')
        || ':' || coalesce(i.item_name, '')
        || ':' || coalesce(i.planned_quantity::text, '')
        || ':' || coalesce(i.actual_quantity::text, '')
        || ':' || coalesce(i.time_from::text, '')
        || ':' || coalesce(i.time_to::text, '')
        || ':' || coalesce(i.note, '')
    from overtime_items i
    union all
    select 'e:' || e.id::text
        || ':' || e.full_name
        || ':' || e.department
        || ':' || coalesce(e.order_no::text, '')
        || ':' || coalesce(e.active::text, '')
    from employees e
  ) t
$$;

revoke execute on function overtime_fingerprint() from public;
revoke execute on function overtime_fingerprint() from anon;
revoke execute on function overtime_fingerprint() from authenticated;
grant execute on function overtime_fingerprint() to service_role;

-- 4. Kiểm ngay:
--    a) phải ra AM = 2 (hoặc 0 nếu phiếu 26/09 đã bị cron 30 ngày xoá → 1), còn lại PM
select shift, count(*) from overtime_registrations group by shift;
--    b) chuỗi 32 ký tự
select overtime_fingerprint();
