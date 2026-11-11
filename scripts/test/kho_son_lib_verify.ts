// Bài kiểm lõi Kho sơn trên điện thoại (lib/kho-son.ts) — 11/11/2026. Không gọi mạng, không đụng Supabase.
//   npx tsx scripts/test/kho_son_lib_verify.ts
import { chiaFifo, duocSua, kiemDongKs, tonTam, type KsPhieu, type KsTon } from '../../lib/kho-son';

let ok = 0, fail = 0;
const ck = (c: boolean, m: string, got?: unknown) => {
  if (c) { ok++; console.log(`   ok  ${m}`); } else { fail++; console.log(`   FAIL ${m}  (got=${JSON.stringify(got)})`); }
};

// số liệu giống file app chính thật 11/11 (sơn xanh 4 lô, lô 1 hết hạn để thử)
const TON: KsTon = { ok: true, phieu_v: { 'XS-261111-01': 1 }, san_pham: [
  { product_id: 'blue', code: '593SB', ten: 'ND Blue', ten_day_du: '', don_vi: 'thùng', kg_moi_dv: 18.14, la_thung: true,
    ton: 19, ton_kg: 0, co_line: true, line_kg: 18.14, lo: [
      { lot_id: 'L0', lot_no: '2925012', han: '2026-10-06', con_ngay: -36, ton: 1, ton_kg: 18.14, muc: 'het' },
      { lot_id: 'L1', lot_no: '4825022', han: '2026-11-19', con_ngay: 8, ton: 5, ton_kg: 0, muc: 'sap' },
      { lot_id: 'L2', lot_no: '0426022', han: '2027-01-23', con_ngay: 73, ton: 2, ton_kg: 0, muc: 'tot' },
      { lot_id: 'L3', lot_no: '0726001', han: '2027-02-09', con_ngay: 90, ton: 8, ton_kg: 0, muc: 'tot' }] },
  { product_id: 'toluene', code: 'TOL', ten: 'Toluene', ten_day_du: '', don_vi: 'lít', kg_moi_dv: 1, la_thung: false,
    ton: 140, ton_kg: 140, co_line: false, line_kg: null, lo: [{ lot_id: 'LT', lot_no: '', han: null, con_ngay: null, ton: 140, ton_kg: 140, muc: 'tot' }] },
] };
const P = (o: Partial<KsPhieu>): KsPhieu => ({ so_phieu: 'XS-261111-01', ngay: '2026-11-11', status: 'pending', version: 1, lines: [],
  history: [], cancel_reason: null, created_by: 'u1', created_by_name: 'A', sent_at: new Date().toISOString(), synced_at: null,
  main_version: null, last_error: null, ...o });

console.log('1. Tồn trừ tạm');
let t = tonTam(TON, [P({ version: 1, lines: [{ line_id: 'a', product_id: 'blue', lot_id: 'L1', qty: 1 }] })]);
ck(t.L1 === 5, 'phiếu v1 app chính ĐÃ tính (phieu_v=1) → không trừ thêm', t.L1);
t = tonTam(TON, [P({ so_phieu: 'XS-261111-02', lines: [{ line_id: 'a', product_id: 'blue', lot_id: 'L1', qty: 2 }] })]);
ck(t.L1 === 3, 'phiếu mới app chính chưa có → trừ tạm 2 thùng', t.L1);
t = tonTam(TON, [P({ version: 2, lines: [{ line_id: 'a', product_id: 'blue', lot_id: 'L1', qty: 3 }],
  history: [{ v: 2, by: 'A', at: '', action: 'sua', reason: 'x', before: [{ line_id: 'a', product_id: 'blue', lot_id: 'L1', qty: 1 }] }] })]);
ck(t.L1 === 3, 'sửa 1 → 3 thùng, app chính mới tính v1: 5 + 1 − 3 = 3', t.L1);
t = tonTam(TON, [P({ version: 2, status: 'cancelled', lines: [{ line_id: 'a', product_id: 'blue', lot_id: 'L1', qty: 1 }],
  history: [{ v: 2, by: 'A', at: '', action: 'huy', reason: 'x', before: [{ line_id: 'a', product_id: 'blue', lot_id: 'L1', qty: 1 }] }] })]);
ck(t.L1 === 6, 'huỷ, app chính mới tính v1: cộng lại → 6', t.L1);
t = tonTam(TON, [P({ so_phieu: 'XS-261111-02', lines: [{ line_id: 'a', product_id: 'blue', lot_id: 'L1', qty: 2 }] })], 'XS-261111-02');
ck(t.L1 === 5, 'đang sửa chính phiếu đó → bỏ qua phiếu (tồn để sửa)', t.L1);
t = tonTam(TON, [P({ version: 1, lines: [{ line_id: 'a', product_id: 'blue', lot_id: 'L1', qty: 1 }] })], 'XS-261111-01');
ck(t.L1 === 6, 'sửa phiếu app chính ĐÃ trừ 1 thùng → tồn khả dụng 5 + 1 = 6 (không chặn oan)', t.L1);

console.log('2. Chia lô FIFO');
const tl = tonTam(TON, []);
ck(JSON.stringify(chiaFifo(TON.san_pham[0], 4, tl)) === JSON.stringify([{ lot_id: 'L0', qty: 1 }, { lot_id: 'L1', qty: 3 }]),
  '4 thùng = lô ① (hết hạn) 1 + lô ② 3', chiaFifo(TON.san_pham[0], 4, tl));
ck(chiaFifo(TON.san_pham[0], 17, tl) === null, '17 thùng > tồn 16 → không chia được');
ck(JSON.stringify(chiaFifo(TON.san_pham[1], 10.5, tl)) === JSON.stringify([{ lot_id: 'LT', qty: 10.5 }]), 'toluene 10,5 lít');

console.log('3. Kiểm dòng');
ck(kiemDongKs([{ line_id: '1', product_id: 'blue', lot_id: 'L1', qty: 1.5 }], TON, tl)?.includes('nguyên thùng') === true, 'sơn số lẻ → chặn');
ck(kiemDongKs([{ line_id: '1', product_id: 'blue', lot_id: 'L2', qty: 2 }, { line_id: '2', product_id: 'blue', lot_id: 'L2', qty: 1 }], TON, tl)?.includes('vượt tồn') === true,
  'cộng 2 dòng cùng lô vượt tồn → chặn');
ck(kiemDongKs([{ line_id: '1', product_id: 'blue', lot_id: 'LX', qty: 1 }], TON, tl)?.includes('lô không còn') === true, 'lô lạ → chặn');
ck(kiemDongKs([{ line_id: '1', product_id: 'toluene', lot_id: 'LT', qty: 10.5 }], TON, tl) === null, 'hợp lệ → null');

console.log('4. Quyền sửa / xoá (anh Hữu 11/11: tổ trưởng Coating, trong 7 ngày)');
const TT = { department: 'CO', role: 'leader' }, TV = { department: 'CO', role: 'worker' };
ck(duocSua(P({ created_by: 'nguoi-khac' }), TT) === true, 'tổ trưởng CO sửa / xoá được cả phiếu tổ trưởng khác lập');
ck(duocSua(P({}), TV) === false, 'tổ viên CO → không');
ck(duocSua(P({}), { department: 'HD', role: 'leader' }) === false, 'tổ trưởng bộ phận khác → không');
ck(duocSua(P({}), { role: 'admin' }) === true, 'admin → được');
ck(duocSua(P({ sent_at: new Date(Date.now() - 8 * 86400_000).toISOString() }), TT) === false, 'quá 7 ngày → không');
ck(duocSua(P({ status: 'cancelled' }), TT) === false, 'phiếu đã xoá → không');

console.log(`\nKẾT QUẢ: ${ok} ok · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
