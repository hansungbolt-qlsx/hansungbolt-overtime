// Kiểm lineTam (lib/kho-son.ts) phần PHIẾU XUẤT chưa tới app chính + file cũ — 20/11/2026.
// Chạy: npx tsx scripts/test/line-tam-xuat.ts
import { lineTam, type KsPhieu, type KsSanPham } from '../../lib/kho-son';

let loi = 0;
const ck = (dk: boolean, ten: string, got?: unknown) => { console.log(`${dk ? '  ok  ' : '  FAIL'} ${ten}${dk ? '' : ' — ' + JSON.stringify(got)}`); if (!dk) loi++; };
const sp: KsSanPham = { product_id: 'blue', code: '593SB', ten: '', ten_day_du: '', don_vi: 'thùng', kg_moi_dv: 18.14, la_thung: true,
  ton: 0, ton_kg: 0, lo: [], co_line: true, line_kg: 10, line_erp_kg: 10, line_moc_ngay: '2026-11-20',
  line_moc_luc: '2026-11-20T14:29:00', line_dm: { '080300-FM5L-DS': [0.08, 14.9] }, line_chot: ['2026-11-19|080300-FM5L-DS'] };
const dong = (q: number) => [{ line_id: 'x', product_id: 'blue', lot_id: 'L1', qty: q }];
const ph = (o: Partial<KsPhieu>): KsPhieu => ({ so_phieu: 'XS-261120-01', ngay: '2026-11-20', status: 'pending', version: 1,
  lines: dong(1), history: [], cancel_reason: null, created_by: null, created_by_name: null,
  sent_at: '2026-11-20T08:00:00Z', synced_at: null, main_version: null, last_error: null, ...o });   // 15:00 VN > mốc 14:29

ck(lineTam(sp, [], [ph({})], {}).kg === 28.14, 'phiếu 1 thùng gửi sau mốc, app chính chưa nhận → +18,14');
ck(lineTam(sp, [], [ph({})], { 'XS-261120-01': 1 }).kg === 10, 'app chính đã tính v1 → không cộng lần 2');
ck(lineTam(sp, [], [ph({ sent_at: '2026-11-20T07:00:00Z' })], {}).kg === 10, 'gửi trước mốc (14:00 VN) → không cộng');
const huy = ph({ status: 'cancelled', version: 2, lines: dong(1),
  history: [{ v: 2, by: 't', at: '', action: 'huy', reason: 'x', before: dong(1) }] });
ck(lineTam(sp, [], [huy], { 'XS-261120-01': 1 }).kg === -8.14, 'huỷ phiếu app chính đã tính v1 → trừ lại 18,14');
const sua = ph({ version: 2, lines: dong(2), history: [{ v: 2, by: 't', at: '', action: 'sua', reason: 'x', before: dong(1) }] });
ck(lineTam(sp, [], [sua], { 'XS-261120-01': 1 }).kg === 28.14, 'sửa 1 → 2 thùng, app chính có v1 → +18,14 phần chênh');
const co = [{ ngay: '2026-11-20', ma: '080300-FM5L-DS', kg: 252 }, { ngay: '2026-11-19', ma: '080300-FM5L-DS', kg: 999 },
  { ngay: '2026-11-18', ma: '080300-FM5L-DS', kg: 999 }, { ngay: '2026-11-20', ma: 'KHAC', kg: 999 }];
const t = lineTam(sp, co, [], {});
ck(t.tam_ea === 16913 && Math.abs(t.tam_kg - 1.353) < 0.0005 && t.kg === 8.647,
  'tạm: chỉ 20/11 (19/11 đã chốt, 18/11 trước mốc, mã lạ) = 16.913 EA × 0,08 g = 1,353 kg', t);
const cu: KsSanPham = { ...sp, line_erp_kg: undefined, line_kg: 7.5 };
ck(lineTam(cu, co, [ph({})], {}).kg === 7.5, 'file cũ (chưa có line_erp_kg) → giữ line_kg app chính');
console.log(`KẾT QUẢ: ${loi ? 'FAIL ' + loi : 'PASS'}`);
process.exit(loi ? 1 : 0);
