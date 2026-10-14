-- 27 · Gia công: phiếu ĐẶT mở rộng công đoạn 89 · 67 · 15 · 20 (14/10/2026 đêm, Claude chuẩn bị — anh Hữu chạy).
-- THỨ TỰ BẮT BUỘC: chạy SQL này TRÊN SUPABASE TRƯỚC, rồi mới push/deploy app tăng ca (ngược lại điện thoại gửi bị lỗi ràng buộc).
-- Không đổi dữ liệu cũ: chỉ nới ràng buộc cột cong_doan. Phiếu NHẬP vẫn chặn ở API (chỉ 70/80).
ALTER TABLE gc_slips DROP CONSTRAINT IF EXISTS gc_slips_cong_doan_check;
ALTER TABLE gc_slips ADD CONSTRAINT gc_slips_cong_doan_check CHECK (cong_doan IN ('70', '80', '89', '67', '15', '20'));
-- Kiểm: SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'gc_slips'::regclass AND contype = 'c';
