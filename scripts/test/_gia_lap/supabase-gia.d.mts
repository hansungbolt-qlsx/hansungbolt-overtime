// Kiểu cho supabase-gia.mjs (để `npx tsc --noEmit` của dự án sạch lỗi). Dòng giả = đối tượng tự do.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const db: Record<string, any[]>;
export const nhatKy: { op: string; table: string; rows: any[] }[];
export function datLai(): void;
export const supabaseAdmin: unknown;
