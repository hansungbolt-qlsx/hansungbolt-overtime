// Cờ "đang nhập dở" (anh Hữu 04/11/2026) — để TaiBanMoi KHÔNG tự tải lại trang khi tổ trưởng
// đang nhập phiếu chưa gửi/lưu (tải lại là mất sạch). Mỗi màn có dữ liệu chưa lưu tự bật/tắt cờ của mình.
const dangDo = new Set<string>();

export function datDangNhapDo(ten: string, bat: boolean): void {
  if (bat) dangDo.add(ten);
  else dangDo.delete(ten);
}

export function coDangNhapDo(): boolean {
  return dangDo.size > 0;
}
