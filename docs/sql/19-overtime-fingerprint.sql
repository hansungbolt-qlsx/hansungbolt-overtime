-- ============================================================
-- Migration 19 — Dấu vân tay dữ liệu TĂNG CA (29/07/2026)
--
-- Vì sao cần: đồng bộ Tăng ca → app chính (menu Overtime) chỉ kéo khi dữ
-- liệu THẬT SỰ đổi. Bảng overtime_registrations/items KHÔNG có updated_at
-- nên đếm dòng + ngày tạo không phát hiện được admin sửa tay (68+ dòng đã
-- sửa). Supabase REST lại cấm hàm gộp trong select → phải gói checksum vào
-- 1 hàm SQL, trả về ~32 byte, agent gọi mỗi 60 giây qua /api/overtime-export.
--
-- Hàm CHỈ ĐỌC (STABLE, không sửa gì). Phủ đúng những trường ảnh hưởng tới
-- bảng tổng hợp người × ngày: phiếu (ngày, bộ phận, loại ngày, giờ), dòng
-- (người, giờ admin sửa) và danh sách nhân viên (tên, bộ phận, STT, active).
--
-- Chạy trong Supabase SQL Editor. Chạy lại lần nữa cũng vô hại.
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
      as row_txt
    from overtime_registrations r
    union all
    select 'i:' || i.id::text
        || ':' || i.registration_id::text
        || ':' || i.employee_id::text
        || ':' || coalesce(i.duration_hours::text, '')
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

-- Chỉ server-side (service role) được gọi — chặn anon/authenticated.
revoke execute on function overtime_fingerprint() from public;
revoke execute on function overtime_fingerprint() from anon;
revoke execute on function overtime_fingerprint() from authenticated;
grant execute on function overtime_fingerprint() to service_role;

-- Thử ngay (phải ra 1 chuỗi 32 ký tự):
select overtime_fingerprint();
