// Danh mục BỘ PHẬN sản xuất của app tăng ca — một chỗ duy nhất (anh Hữu 05/10/2026 thêm Coating).
//
// - PROD_DEPTS: bộ phận có tổ trưởng đăng ký tăng ca theo máy (có dòng trong `equipments`).
//   HD = dập (Heading) · RL = cán ren (Rolling, gồm SM/CT) · CO = Coating (sơn).
// - 'QLSX' là bộ phận của vai trò qlsx (xem + in, không đăng ký) — KHÔNG nằm trong PROD_DEPTS.
// - DB: migration 23 nới CHECK 4 bảng cho 'CO'. Thêm bộ phận mới = sửa ĐÂY + migration mới.
//
// ⚠ Phân quyền in DCCD theo công đoạn ERP nằm ở `DCCD_GJ_BY_DEPT` (dùng chung PlanView + API print-jobs).

export const PROD_DEPTS = ['HD', 'RL', 'CO'] as const;
export type ProdDept = (typeof PROD_DEPTS)[number];

export type Dept = ProdDept | 'QLSX';
export const ALL_DEPTS: readonly Dept[] = ['HD', 'RL', 'CO', 'QLSX'];

export function isProdDept(v: unknown): v is ProdDept {
  return typeof v === 'string' && (PROD_DEPTS as readonly string[]).includes(v);
}

export function isDept(v: unknown): v is Dept {
  return typeof v === 'string' && (ALL_DEPTS as readonly string[]).includes(v);
}

/** Nhãn hiển thị. HD/RL giữ nguyên chữ viết tắt như trước; CO hiện "Coating" cho dễ hiểu. */
export const DEPT_LABEL: Record<Dept, string> = {
  HD: 'HD',
  RL: 'RL',
  CO: 'Coating',
  QLSX: 'QLSX',
};

/** Màu nhận diện (hex) — HD navy · RL teal · CO cam · QLSX tím. */
export const DEPT_ACCENT: Record<Dept, string> = {
  HD: '#063882',
  RL: '#2db5a1',
  CO: '#ea580c',
  QLSX: '#7c3aed',
};

/** Thứ tự hiển thị khi gộp nhiều bộ phận. */
export const DEPT_ORDER: readonly Dept[] = ['HD', 'RL', 'CO', 'QLSX'];

/**
 * Công đoạn ERP mà TỔ TRƯỞNG mỗi bộ phận được in phiếu DCCD lẻ (user 13/7; CO 05/10).
 * HD → 10 H/D · RL → 30 R/L, 45 S/R, 60 C/T · CO → 86 CO/ST/PK (công đoạn Coating trên ERP).
 * admin + qlsx: đủ mọi công đoạn trong bảng này.
 */
export const DCCD_GJ_BY_DEPT: Record<ProdDept, [string, string][]> = {
  HD: [['10', 'CĐ 10 — H/D']],
  RL: [
    ['30', 'CĐ 30 — R/L'],
    ['45', 'CĐ 45 — S/R'],
    ['60', 'CĐ 60 — C/T'],
  ],
  CO: [['86', 'CĐ 86 — CO/ST/PK']],
};
export const DCCD_GJ_ALL: [string, string][] = PROD_DEPTS.flatMap((d) => DCCD_GJ_BY_DEPT[d]);

/** Bộ phận CO nhập RPM TAY trên form đăng ký (máy CO trong `equipments` rpm = 0). */
export function deptNeedsManualRpm(dept: string): boolean {
  return dept === 'CO';
}
