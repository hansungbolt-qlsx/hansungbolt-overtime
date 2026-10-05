// Kiểm TĨNH bộ phận CO (Coating) — anh Hữu chốt 05/10/2026 (khối 1).
// Chạy:  node scripts/test/coating_dept_verify.mjs
// Không gọi mạng, không đụng Supabase. Kiểm: danh mục, migration, mọi điểm phân quyền/giao diện
// đã nhận 'CO', template Excel có sheet CO, không còn union 'HD' | 'RL' bỏ sót CO ở file liên quan.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

let ok = 0, bad = 0;
const ck = (c, msg, extra = '') => { if (c) { ok++; console.log('   ok ', msg); } else { bad++; console.log('   SAI', msg, extra); } };
const read = (p) => readFileSync(p, 'utf8');

console.log('A. Danh mục + migration');
const dep = read('lib/departments.ts');
ck(/PROD_DEPTS = \['HD', 'RL', 'CO'\]/.test(dep), 'PROD_DEPTS = HD, RL, CO');
ck(/CO: \[\['86', 'CĐ 86 — CO\/ST\/PK'\]\]/.test(dep), 'DCCD CO → công đoạn 86');
ck(/deptNeedsManualRpm[\s\S]*dept === 'CO'/.test(dep), 'CO nhập RPM tay');
const mig = read('docs/sql/23-coating-department.sql');
ck((mig.match(/ADD CONSTRAINT \w+_department_check/g) || []).length === 4, 'migration nới CHECK 4 bảng', String((mig.match(/ADD CONSTRAINT/g) || []).length));
ck((mig.match(/IN \('HD', 'RL', 'QLSX', 'CO'\)/g) || []).length === 4, "4 CHECK đều có 'CO'");
ck(/\('CO-01', 'CO'[\s\S]*\('CO-02', 'CO'[\s\S]*\('CO-03', 'CO'/.test(mig), 'seed 3 máy CO-01..03');
for (const n of ['NGUYỄN ĐỨC HIẾU', 'NGUYỄN CHÍ HIẾU', 'NGUYỄN CHÍ TRUNG', 'ĐỖ ĐĂNG THẮNG']) ck(mig.includes(`('${n}'`), `seed NV ${n}`);
ck(/ON CONFLICT \(code\) DO NOTHING/.test(mig) && /ON CONFLICT \(department, order_no\) DO NOTHING/.test(mig), 'seed idempotent');

console.log('B. Phân quyền + API');
ck(/department: 'HD' \| 'RL' \| 'QLSX' \| 'CO' \| null/.test(read('lib/auth.ts')), 'Session.department có CO');
const users = read('app/api/users/route.ts');
ck(/isProdDept\(department\)/.test(users) && !/department !== 'HD' && department !== 'RL'/.test(users), 'POST /api/users nhận CO qua isProdDept');
const pj = read('app/api/print-jobs/route.ts');
ck(/DCCD_GJ_BY_DEPT/.test(pj) && !/HD: \['10'\],\n\s+RL: \['30', '45', '60'\],/.test(pj), 'print-jobs DCCD dùng bảng chung (CO 86)');
const ts = read('app/api/registrations/today-summary/route.ts');
ck(/CO: \[\]/.test(ts) && /else if \(dept === 'CO'\) co\.push\(rest\)/.test(ts) && /departments: \{ HD: hd, RL: rl, CO: co \}/.test(ts), 'today-summary gom nhóm CO');
const pid = read('app/api/registrations/[id]/route.ts');
ck(/rpm\?: number;/.test(pid) && /typeof it\.rpm === 'number' && it\.rpm > 0 \? it\.rpm : \(eq\?\.rpm \?\? 0\)/.test(pid), 'PATCH nhận rpm tay');
const exp = read('app/api/export/[id]/route.ts');
ck(/Record<'HD' \| 'RL' \| 'CO', string\[\]>/.test(exp) && /CO: \['B9:M9'/.test(exp) && /reg\.department !== 'CO'/.test(exp), 'export Excel nhận CO (bố cục RL)');
ck(/sp\.dept === 'CO'/.test(read('app/print/overtime-summary/page.tsx')), 'trang in tổng hợp nhận dept=CO');

console.log('C. Giao diện');
const um = read('components/UserManagementCard.tsx');
ck(/PROD_DEPTS\.map\(\(d\) =>/.test(um) && /'Admin', 'QLSX', 'HD', 'RL', 'CO'/.test(um) && /'HD' \| 'RL' \| 'QLSX' \| 'CO' \| null/.test(um), 'Quản lý tài khoản: chọn CO + nhóm CO');
const sm = read('components/OvertimeSummaryCard.tsx');
ck(/type Dept = 'HD' \| 'RL' \| 'CO' \| 'QLSX'/.test(sm) && /\['HD', 'RL', 'CO', 'QLSX'\]/.test(sm) && /CO: 'bg-\[#ea580c\]/.test(sm), 'Tổng hợp tăng ca: tab/badge CO');
const tc = read('components/TodayOvertimeCard.tsx');
ck(/showCO/.test(tc) && /title="Coating"/.test(tc) && /CO\?: EmpRow\[\]/.test(tc), 'Tăng ca hôm nay: khối Coating');
const rl = read('components/RegisterLayout.tsx');
ck(/\(isLeader && department !== 'CO'\) \|\| isQlsx/.test(rl), 'RegisterLayout: CO không có tab Máy dừng');
const pv = read('components/PlanView.tsx');
ck(/DCCD_GJ_BY_DEPT/.test(pv) && /DCCD_GJ_ALL/.test(pv) && !/HD: \[\['10', 'CĐ 10 — H\/D'\]\]/.test(pv), 'PlanView dùng bảng công đoạn chung');
for (const f of ['components/OvertimeForm.tsx', 'components/LeaderEditForm.tsx']) {
  const s = read(f);
  ck(/deptNeedsManualRpm/.test(s) && /machineRpm/.test(s) && /updateMachineRpm/.test(s) && /rpmOf\(row, machine\)/.test(s) && /chưa nhập RPM/.test(s) && /placeholder="Nhập RPM"/.test(s), `${f}: RPM tay cho CO`);
}
ck(/planned_quantity: i\.planned_quantity/.test(read('app/dashboard/registrations/[id]/edit/page.tsx')), 'trang sửa truyền planned_quantity (suy RPM)');

console.log('D. Không còn union HD|RL bỏ sót CO ở file liên quan');
const files = execSync('git ls-files app components lib', { encoding: 'utf8' }).split(/\r?\n/).filter((f) => /\.(ts|tsx)$/.test(f));
const leftovers = [];
for (const f of files) {
  const s = read(f);
  const re = /'HD' \| 'RL'(?! \|)/g; let m;
  while ((m = re.exec(s))) {
    const line = s.slice(0, m.index).split('\n').length;
    leftovers.push(`${f}:${line}`);
  }
}
// Cho phép: lib/nvl-slips.ts dùng 'Heading'|'Rolling' (kho NVL, không liên quan); không có union HD|RL thuần nào khác được phép
ck(leftovers.length === 0, "không còn union 'HD' | 'RL' thiếu CO", leftovers.join(', '));

console.log('E. Template Excel');
ck(existsSync('public/templates/overtime-form.xlsx'), 'template tồn tại');
try {
  const out = execSync('python -c "import openpyxl,sys; wb=openpyxl.load_workbook(\'public/templates/overtime-form.xlsx\'); print(\',\'.join(wb.sheetnames)); print(len(wb[\'RL\'].merged_cells.ranges), len(wb[\'CO\'].merged_cells.ranges))"', { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).trim().split(/\r?\n/);
  ck(out[0].split(',').includes('CO'), 'template có sheet CO', out[0]);
  const [a, b] = out[1].split(' ');
  ck(a === b, `sheet CO có cùng số ô gộp với RL (${a})`);
} catch (e) { ck(false, 'đọc template', String(e).slice(0, 120)); }

console.log(`\n${bad === 0 ? 'PASS' : 'FAIL'} — ${ok} ok · ${bad} sai`);
process.exit(bad ? 1 : 0);
