// Cảnh báo nhầm nguyên liệu theo KHSX hôm nay (anh Hữu 30/10/2026).
// App chính tính (services/planning/nvl_nham.py) lúc đồng bộ KHSX → PUT /api/nvl-canh-bao.
// A = nhiều máy cùng size khác mác · B = máy đổi mã trong ngày cùng size khác mác.

export type NvlMac = { mac: string; may: string[] };
export type NvlNhomA = { size: string; nhom: 'STS' | 'THEP'; mac: NvlMac[] };
export type NvlDongB = {
  may: string;
  size: string;
  tu: { ma: string; mac: string; ngay?: string }; // ngay = 'dd/mm' khi so với lần chạy cuối trước hôm nay
  sang: { ma: string; mac: string };
};
export type NvlCanhBao = {
  a?: NvlNhomA[];
  b?: NvlDongB[];
  n?: number;
  snap_id?: number;
  loi?: string; // app chính tính lỗi → báo, KHÔNG hiện danh sách cũ
};

// Màu mác theo thứ tự trong 1 dòng: mác 1 đỏ · mác 2 xanh (anh chốt) · dự phòng xanh lá, tím
export const MAU_MAC = ['#d20000', '#0046c8', '#047857', '#7c3aed'];
