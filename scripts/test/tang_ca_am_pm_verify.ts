// Kiểm tăng ca AM/PM (anh Hữu 21/10/2026) — CHỈ ĐỌC Supabase (service key ở .env.local), không ghi gì.
//   npx tsx scripts/test/tang_ca_am_pm_verify.ts
// 1) Hồi quy trên TOÀN BỘ phiếu thật:
//    a) hàm thật = luật tính lại ĐỘC LẬP ở đây (MAX trong từng ca → cộng các ca), mọi ô;
//    b) ô người × ngày chỉ MỘT ca → phải y hệt luật CŨ (MAX cả ngày);
//    c) ô có 2 ca (AM + PM) → liệt kê ra, giờ = tổng 2 ca.
//    (Sửa 04/11/2026: bản cũ giả định "chưa ngày nào một người có 2 ca" — từ 21/10 đã có
//     người làm cả AM + PM nên bài báo sai dù app đúng; anh Hữu đồng ý sửa bài.)
// 2) Trang Tổng hợp giờ: bản mới (gọi lib) = bản cũ (luật chép riêng) cho từng tháng có dữ liệu.
// 3) Ca kép giả lập: AM 1,5h + PM 3h = 4,5h …
// 4) Hàm lib: giờ mặc định, giờ tính sản lượng, chồng giờ.
import fs from 'node:fs';
import { buildEmpDateHours } from '../../lib/overtime-hours';
import { normShift, overlaps, presetOf, qtyHoursOf } from '../../lib/overtime-shift';

let pass = 0;
let fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log('  ✗ ' + msg);
  }
}

// ---- luật CŨ (chép nguyên bản HEAD f1af697 lib/overtime-hours.ts) ----
type R = { id: string; overtime_date: string; day_type: string; duration_hours: number | null; shift?: string | null; department?: string };
type I = { employee_id: string; registration_id: string; duration_hours: number | null };
function oldHours(regs: R[], items: I[]) {
  const regMap = new Map(regs.map((r) => [r.id, { date: r.overtime_date, dayType: r.day_type, durationHours: Number(r.duration_hours ?? 0) }]));
  const m = new Map<string, Map<string, number>>();
  for (const it of items) {
    const reg = regMap.get(it.registration_id);
    if (!reg) continue;
    if (!m.has(it.employee_id)) m.set(it.employee_id, new Map());
    const dm = m.get(it.employee_id)!;
    const h = Number(it.duration_hours ?? reg.durationHours ?? (reg.dayType === 'sunday' ? 8 : 3));
    if (h > (dm.get(reg.date) ?? 0)) dm.set(reg.date, h);
  }
  return m;
}
// ---- luật KỲ VỌNG (viết lại độc lập, không gọi lib): MAX theo người × ngày × ca → cộng các ca ----
function shiftOf(r: R) { return r.day_type === 'sunday' ? 'PM' : (r.shift === 'AM' ? 'AM' : 'PM'); }
function expHours(regs: R[], items: I[]) {
  const regMap = new Map(regs.map((r) => [r.id, r]));
  const perShift = new Map<string, Map<string, Map<string, number>>>();   // emp → date → ca → MAX
  for (const it of items) {
    const reg = regMap.get(it.registration_id);
    if (!reg) continue;
    const h = Number(it.duration_hours ?? reg.duration_hours ?? (reg.day_type === 'sunday' ? 8 : 3));
    if (!perShift.has(it.employee_id)) perShift.set(it.employee_id, new Map());
    const dm = perShift.get(it.employee_id)!;
    if (!dm.has(reg.overtime_date)) dm.set(reg.overtime_date, new Map());
    const sm = dm.get(reg.overtime_date)!;
    const ca = shiftOf(reg);
    if (h > (sm.get(ca) ?? 0)) sm.set(ca, h);
    else if (!sm.has(ca)) sm.set(ca, h);
  }
  const tong = new Map<string, Map<string, number>>();
  for (const [emp, dm] of perShift) {
    const out = new Map<string, number>();
    for (const [d, sm] of dm) out.set(d, [...sm.values()].reduce((a, b) => a + b, 0));
    tong.set(emp, out);
  }
  return { tong, perShift };
}
// ---- trang Tổng hợp CŨ (chép nguyên bản HEAD app/api/registrations/summary/route.ts) ----
function oldSummary(regs: R[], items: I[]) {
  const ky = expHours(regs, items).tong;   // giờ mỗi ô theo luật kỳ vọng (AM + PM cộng)
  const regMap = new Map(regs.map((r) => [r.id, { date: r.overtime_date, dayType: r.day_type, durationHours: Number(r.duration_hours ?? 0) }]));
  const edh = new Map<string, Map<string, { hours: number; dayType: string }>>();
  for (const it of items) {
    const reg = regMap.get(it.registration_id);
    if (!reg) continue;
    if (!edh.has(it.employee_id)) edh.set(it.employee_id, new Map());
    const dm = edh.get(it.employee_id)!;
    const hours = Number(it.duration_hours ?? reg.durationHours ?? (reg.dayType === 'sunday' ? 8 : 3));
    const ex = dm.get(reg.date);
    if (!ex || hours > ex.hours) dm.set(reg.date, { hours, dayType: reg.dayType });
  }
  const out = new Map<string, string>();
  for (const [emp, dm] of edh) {
    let wk = 0, su = 0, tot = 0;
    const bd: Record<string, number> = {};
    for (const [d, v] of dm) {
      if (v.dayType === 'sunday') su++; else wk++;
      const h = ky.get(emp)!.get(d)!;
      tot += h;
      bd[d] = h;
    }
    out.set(emp, JSON.stringify({ wk, su, tot: Number(tot.toFixed(2)), bd: Object.fromEntries(Object.entries(bd).sort()) }));
  }
  return out;
}
function newSummary(regs: R[], items: I[]) {
  const { empDateMap, dateTypeMap } = buildEmpDateHours(regs, items);
  const out = new Map<string, string>();
  for (const [emp, dm] of empDateMap) {
    let wk = 0, su = 0, tot = 0;
    for (const [d, h] of dm) {
      if (dateTypeMap.get(d) === 'sunday') su++; else wk++;
      tot += h;
    }
    out.set(emp, JSON.stringify({ wk, su, tot: Number(tot.toFixed(2)), bd: Object.fromEntries([...dm].sort()) }));
  }
  return out;
}

async function main() {
  const env = Object.fromEntries(
    fs.readFileSync('C:/hansungbolt-overtime/.env.local', 'utf8').split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
  );
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const get = async (p: string) => {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const r = await fetch(`${url}/rest/v1/${p}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` } });
      const d = (await r.json()) as unknown[];
      if (!Array.isArray(d)) throw new Error(JSON.stringify(d));
      rows.push(...d);
      if (d.length < 1000) break;
    }
    return rows;
  };

  console.log('1) Hồi quy luật giờ trên dữ liệu thật');
  const regs = (await get('overtime_registrations?select=*&order=id')) as R[];
  const items = (await get('overtime_items?select=employee_id,registration_id,duration_hours&order=id')) as I[];
  const coShift = regs.some((r) => 'shift' in r);
  console.log(`   ${regs.length} phiếu · ${items.length} dòng · cột shift trên Supabase: ${coShift ? 'CÓ' : 'chưa (SQL 28 chưa chạy) → giả lập'}`);
  // Giả lập đúng SQL 28 khi chưa chạy: 2 phiếu QLSX sáng 26/09 + 10/10 = AM
  for (const r of regs as (R & { time_from: string; time_to: string })[]) {
    if (!coShift) {
      r.shift = r.department === 'QLSX' && r.day_type === 'weekday'
        && ['2026-09-26', '2026-10-10'].includes(r.overtime_date)
        && r.time_from === '06:00:00' && r.time_to === '07:30:00' ? 'AM' : 'PM';
    }
  }
  console.log(`   phiếu AM: ${regs.filter((r) => r.shift === 'AM').map((r) => `${r.overtime_date} ${r.department}`).join(', ') || '(không có)'}`);
  const oldM = oldHours(regs, items);
  const { tong: expM, perShift } = expHours(regs, items);
  const { empDateMap: newM } = buildEmpDateHours(regs, items);
  // a) hàm thật = luật kỳ vọng, mọi ô
  let cells = 0, diff = 0, sumExp = 0, sumNew = 0;
  for (const [emp, dm] of expM) for (const [d, h] of dm) {
    cells++; sumExp += h;
    const n = newM.get(emp)?.get(d);
    if (n !== h) { diff++; console.log(`   lệch ${emp.slice(0, 8)} ${d}: kỳ vọng ${h} hàm thật ${n}`); }
  }
  for (const [emp, dm] of newM) for (const [d, h] of dm) {
    sumNew += h;
    if (!expM.get(emp)?.has(d)) { diff++; console.log(`   ô THỪA ${emp.slice(0, 8)} ${d} = ${h}`); }
  }
  console.log(`   ${cells} ô người × ngày · tổng giờ kỳ vọng ${sumExp} · hàm thật ${sumNew} · lệch ${diff}`);
  ok(diff === 0 && sumExp === sumNew && cells > 0, 'a) hàm thật = luật MAX trong ca → cộng ca, trên toàn bộ dữ liệu thật');
  // b) ô một ca = luật cũ · c) ô hai ca liệt kê
  let motCa = 0, lechMotCa = 0, haiCa = 0;
  for (const [emp, dm] of perShift) for (const [d, sm] of dm) {
    const n = newM.get(emp)?.get(d);
    if (sm.size === 1) {
      motCa++;
      if (n !== oldM.get(emp)?.get(d)) { lechMotCa++; console.log(`   lệch 1 ca ${emp.slice(0, 8)} ${d}: cũ ${oldM.get(emp)?.get(d)} mới ${n}`); }
    } else {
      haiCa++;
      console.log(`   2 ca: ${emp.slice(0, 8)} ${d} · ${[...sm].map(([c, h]) => `${c} ${h}h`).join(' + ')} = ${n}h`);
      ok(n === [...sm.values()].reduce((a, b) => a + b, 0), `c) ô 2 ca ${d} = tổng 2 ca`);
    }
  }
  console.log(`   ${motCa} ô một ca · ${haiCa} ô hai ca`);
  ok(motCa > 0 && lechMotCa === 0, 'b) ô một ca: y hệt luật cũ (MAX cả ngày)');

  console.log('2) Trang Tổng hợp giờ theo từng tháng');
  const months = [...new Set(regs.map((r) => r.overtime_date.slice(0, 7)))].sort();
  for (const m of months) {
    for (const dept of [null, 'HD', 'RL', 'CO', 'QLSX']) {
      const rs = regs.filter((r) => r.overtime_date.startsWith(m) && (!dept || r.department === dept));
      if (rs.length === 0) continue;
      const ids = new Set(rs.map((r) => r.id));
      const its = items.filter((i) => ids.has(i.registration_id));
      const a = oldSummary(rs, its), b = newSummary(rs, its);
      let d = 0;
      for (const [k, v] of a) if (b.get(k) !== v) d++;
      for (const k of b.keys()) if (!a.has(k)) d++;
      ok(d === 0, `Tổng hợp ${m} ${dept ?? 'tất cả'}: lệch ${d} người`);
      if (d === 0) pass += 0;
    }
    console.log(`   ${m}: so ${a_len(regs, m)} phiếu — xong`);
  }

  console.log('3) Ca kép giả lập');
  const R2 = (id: string, dt: string, sh: string, dur: number, date = '2026-10-22'): R => ({ id, overtime_date: date, day_type: dt, duration_hours: dur, shift: sh });
  const t1 = buildEmpDateHours([R2('am', 'weekday', 'AM', 1.5), R2('pm', 'weekday', 'PM', 3)],
    [{ employee_id: 'e', registration_id: 'am', duration_hours: null }, { employee_id: 'e', registration_id: 'pm', duration_hours: null }, { employee_id: 'e', registration_id: 'pm', duration_hours: null }]).empDateMap.get('e')!.get('2026-10-22');
  ok(t1 === 4.5, `AM 1,5 + PM 3 (2 máy) = 4,5 (ra ${t1})`);
  const t2 = buildEmpDateHours([R2('am', 'weekday', 'AM', 1.5), R2('pm', 'weekday', 'PM', 3)],
    [{ employee_id: 'e', registration_id: 'am', duration_hours: 2 }, { employee_id: 'e', registration_id: 'pm', duration_hours: 3.5 }, { employee_id: 'e', registration_id: 'pm', duration_hours: 3 }]).empDateMap.get('e')!.get('2026-10-22');
  ok(t2 === 5.5, `admin sửa AM 2h + PM max(3,5;3) = 5,5 (ra ${t2})`);
  const t3 = buildEmpDateHours([R2('pm', 'weekday', 'PM', 3)], [{ employee_id: 'e', registration_id: 'pm', duration_hours: null }, { employee_id: 'e', registration_id: 'pm', duration_hours: null }]).empDateMap.get('e')!.get('2026-10-22');
  ok(t3 === 3, `chỉ PM, 2 máy = 3 (không cộng dòng) (ra ${t3})`);
  const t4 = buildEmpDateHours([{ id: 'x', overtime_date: '2026-10-22', day_type: 'weekday', duration_hours: 3 }], [{ employee_id: 'e', registration_id: 'x', duration_hours: null }]).empDateMap.get('e')!.get('2026-10-22');
  ok(t4 === 3, `phiếu cũ không có cột ca → PM, 3h (ra ${t4})`);
  const t5 = buildEmpDateHours([R2('su', 'sunday', 'AM', 8, '2026-10-25')], [{ employee_id: 'e', registration_id: 'su', duration_hours: null }]).empDateMap.get('e')!.get('2026-10-25');
  ok(t5 === 8, `Chủ nhật = 8 (ra ${t5})`);
  const t6 = buildEmpDateHours([R2('am', 'weekday', 'AM', 1.5), R2('am2', 'weekday', 'AM', 1.5)], [{ employee_id: 'e', registration_id: 'am', duration_hours: null }, { employee_id: 'e', registration_id: 'am2', duration_hours: null }]).empDateMap.get('e')!.get('2026-10-22');
  ok(t6 === 1.5, `2 phiếu cùng ca AM (nếu lọt chặn) không cộng đôi = 1,5 (ra ${t6})`);
  const s1 = newSummary([R2('am', 'weekday', 'AM', 1.5), R2('pm', 'weekday', 'PM', 3)], [{ employee_id: 'e', registration_id: 'am', duration_hours: null }, { employee_id: 'e', registration_id: 'pm', duration_hours: null }]).get('e');
  ok(s1 === JSON.stringify({ wk: 1, su: 0, tot: 4.5, bd: { '2026-10-22': 4.5 } }), `Tổng hợp: 1 ngày thường, ô ngày hiện tổng 4,5 (ra ${s1})`);

  console.log('4) Hàm lib');
  ok(JSON.stringify(presetOf('weekday', 'PM')) === JSON.stringify({ time_from: '16:30:00', time_to: '19:30:00', duration_hours: 3 }), 'PM 16:30–19:30 3h');
  ok(JSON.stringify(presetOf('weekday', 'AM')) === JSON.stringify({ time_from: '06:00:00', time_to: '07:30:00', duration_hours: 1.5 }), 'AM 06:00–07:30 1,5h');
  ok(presetOf('sunday', 'AM').duration_hours === 8, 'Chủ nhật bỏ qua ca = 8h');
  ok(normShift('sunday', 'AM') === 'PM' && normShift('weekday', undefined) === 'PM' && normShift('weekday', 'AM') === 'AM', 'normShift');
  ok(qtyHoursOf(1.5, 'AM') === 1.5 && qtyHoursOf(2, 'AM') === 2, 'AM tính SL đủ giờ (1,5 → 1,5 · 2 → 2)');
  ok(qtyHoursOf(3, 'PM') === 2.5 && qtyHoursOf(8, 'PM') === 7.5 && qtyHoursOf(4, 'PM') === 3.5, 'PM/CN trừ 0,5h (3→2,5 · 8→7,5)');
  ok(!overlaps('06:00:00', '07:30:00', '16:30:00', '19:30:00'), 'AM mặc định không chồng PM mặc định');
  ok(overlaps('06:00', '17:00', '16:30:00', '19:30:00'), 'AM sửa 06:00–17:00 chồng PM');
  ok(!overlaps('06:00', '07:30', '07:30', '10:00'), 'chạm mép 07:30 không tính chồng');
  ok(overlaps('06:00:00', '14:00:00', '06:00:00', '07:30:00'), 'CN 06–14 chồng AM');

  console.log(`\nKẾT QUẢ: ${pass} đạt · ${fail} sai`);
  process.exit(fail ? 1 : 0);
}
function a_len(regs: R[], m: string) { return regs.filter((r) => r.overtime_date.startsWith(m)).length; }

main().catch((e) => { console.error(e); process.exit(2); });
