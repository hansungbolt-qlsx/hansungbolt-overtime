// Đối chiếu CHÉO Tồn Line điện thoại (lib/kho-son.ts lineTam) ↔ app chính (coating_kho.ton_line) — 20/11/2026.
// Chạy: npx tsx scripts/test/line-tam-cheo.ts <file_ton.json> <co_dong.json> [phieu.json]
// In JSON {product_id: {kg, tam_kg, tam_ea, xuat_cho_kg}} — script Python app chính so với kết quả của nó.
import { readFileSync } from 'fs';
import { lineTam, type KsCoDong, type KsPhieu, type KsTon } from '../../lib/kho-son';

const ton = JSON.parse(readFileSync(process.argv[2], 'utf-8')) as KsTon;
const coDong = JSON.parse(readFileSync(process.argv[3], 'utf-8')) as KsCoDong[];
const phieu = (process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf-8')) : []) as KsPhieu[];
const out: Record<string, unknown> = {};
for (const sp of ton.san_pham) if (sp.co_line) out[sp.product_id] = lineTam(sp, coDong, phieu, ton.phieu_v || {});
console.log(JSON.stringify(out));
