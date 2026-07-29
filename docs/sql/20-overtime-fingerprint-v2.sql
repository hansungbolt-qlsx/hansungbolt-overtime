-- ============================================================
-- Migration 20 — Vân tay tăng ca v2 (29/07/2026 tối)
--
-- Vì sao: app chính giờ lưu cả CHI TIẾT dòng phiếu (máy, mã hàng, số lượng,
-- khung giờ, ghi chú) làm bản sao lưu toàn bộ. Vân tay v1 chỉ phủ giờ — admin
-- sửa máy/mã hàng/ghi chú sẽ KHÔNG kích hoạt đồng bộ. v2 phủ thêm các cột đó
-- (+ khung giờ phiếu). Ghi đè thẳng hàm cũ, chạy lại lần nữa vô hại.
-- ============================================================

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

-- Quyền đã cấp ở migration 19, replace giữ nguyên — nhắc lại cho chắc:
revoke execute on function overtime_fingerprint() from public;
revoke execute on function overtime_fingerprint() from anon;
revoke execute on function overtime_fingerprint() from authenticated;
grant execute on function overtime_fingerprint() to service_role;

-- Thử ngay (ra chuỗi 32 ký tự, KHÁC chuỗi của v1 là đúng):
select overtime_fingerprint();
