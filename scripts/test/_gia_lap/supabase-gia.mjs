// SUPABASE GIẢ trong bộ nhớ — thay `@/lib/supabase` khi chạy bài kiểm route (anh Hữu 04/11/2026).
// Mục đích: chạy ĐÚNG code route/phiếu in thật mà KHÔNG ghi gì lên Supabase thật
// (ghi thật dù ngày giả vẫn có thể bị agent đồng bộ sang app chính trong 5 phút).
// Chỉ hỗ trợ các lệnh app tăng ca đang dùng: select/insert/update/delete + eq/neq/in/order/range
// + maybeSingle/single + rpc('overtime_fingerprint').
import { randomUUID } from 'node:crypto';

// Cột của từng bảng — dòng thêm thiếu cột thì cột đó = null (như Postgres khi cột không có default)
const COT = {
  overtime_registrations: ['id', 'department', 'registered_by', 'overtime_date', 'day_type', 'shift',
    'time_from', 'time_to', 'duration_hours', 'status'],
  overtime_items: ['id', 'registration_id', 'employee_id', 'equipment_id', 'item_code', 'item_name',
    'planned_quantity', 'actual_quantity', 'note', 'time_from', 'time_to', 'duration_hours'],
  employees: ['id', 'full_name', 'department', 'order_no', 'active'],
  equipments: ['id', 'code', 'department', 'spec', 'machine_type', 'rpm'],
  users: ['id', 'full_name'],
};
const MAC_DINH = { overtime_registrations: { shift: 'PM', status: 'pending' } };

export const db = Object.fromEntries(Object.keys(COT).map((t) => [t, []]));
export const nhatKy = [];   // mọi lệnh ghi: { op, table, rows }

export function datLai() {
  for (const t of Object.keys(db)) db[t].length = 0;
  nhatKy.length = 0;
}

const sao = (o) => JSON.parse(JSON.stringify(o));

class Q {
  constructor(table) {
    if (!COT[table]) throw new Error(`Bảng giả chưa khai báo: ${table}`);
    this.table = table; this.op = 'select'; this.loc = []; this.payload = null;
    this.kieu = 'many'; this.range_ = null; this.order_ = null;
  }
  select() { if (this.op === 'select') this.op = 'select'; return this; }
  insert(rows) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(obj) { this.op = 'update'; this.payload = obj; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.loc.push((r) => r[c] === v); return this; }
  neq(c, v) { this.loc.push((r) => r[c] !== v); return this; }
  in(c, arr) { const s = new Set(arr); this.loc.push((r) => s.has(r[c])); return this; }
  order(c) { this.order_ = c; return this; }
  range(a, b) { this.range_ = [a, b]; return this; }
  maybeSingle() { this.kieu = 'maybe'; return this; }
  single() { this.kieu = 'single'; return this; }
  khop(r) { return this.loc.every((f) => f(r)); }
  chay() {
    const bang = db[this.table];
    let out;
    if (this.op === 'insert') {
      out = this.payload.map((p) => {
        const r = Object.fromEntries(COT[this.table].map((c) => [c, null]));
        Object.assign(r, MAC_DINH[this.table] ?? {});
        for (const [k, v] of Object.entries(p)) {
          if (!COT[this.table].includes(k)) return { loi: `cột không tồn tại: ${this.table}.${k}` };
          r[k] = v;
        }
        r.id = r.id ?? randomUUID();
        return r;
      });
      const loi = out.find((r) => r.loi);
      if (loi) return { data: null, error: { message: loi.loi } };
      bang.push(...out);
      nhatKy.push({ op: 'insert', table: this.table, rows: sao(out) });
    } else if (this.op === 'update') {
      for (const k of Object.keys(this.payload)) {
        if (!COT[this.table].includes(k)) return { data: null, error: { message: `cột không tồn tại: ${this.table}.${k}` } };
      }
      out = bang.filter((r) => this.khop(r));
      for (const r of out) Object.assign(r, this.payload);
      nhatKy.push({ op: 'update', table: this.table, rows: sao(out) });
    } else if (this.op === 'delete') {
      out = bang.filter((r) => this.khop(r));
      for (const r of out) bang.splice(bang.indexOf(r), 1);
      // Xoá phiếu → xoá dòng theo (giống ON DELETE CASCADE)
      if (this.table === 'overtime_registrations') {
        const ids = new Set(out.map((r) => r.id));
        db.overtime_items = db.overtime_items.filter((i) => !ids.has(i.registration_id));
      }
      nhatKy.push({ op: 'delete', table: this.table, rows: sao(out) });
    } else {
      out = bang.filter((r) => this.khop(r));
      if (this.order_) out = [...out].sort((a, b) => String(a[this.order_]).localeCompare(String(b[this.order_])));
      if (this.range_) out = out.slice(this.range_[0], this.range_[1] + 1);
    }
    out = sao(out);
    if (this.kieu === 'many') return { data: out, error: null };
    if (this.kieu === 'single' && out.length !== 1) return { data: null, error: { message: `single: ${out.length} dòng` } };
    return { data: out[0] ?? null, error: null };
  }
  then(ok, ng) { return Promise.resolve().then(() => this.chay()).then(ok, ng); }
}

export const supabaseAdmin = {
  from: (t) => new Q(t),
  rpc: async () => ({ data: 'fp-gia', error: null }),
};
