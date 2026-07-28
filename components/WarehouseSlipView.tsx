'use client';

// XUẤT / TRẢ KHO NGUYÊN PHỤ LIỆU trên điện thoại (28/07/2026).
//
// Nguyên tắc nền: app chính là CHỦ KHO DUY NHẤT. Màn này chỉ GHI YÊU CẦU —
// bấm Gửi thì agent đẩy sang app chính, người duyệt bấm Duyệt thì tồn mới đổi.
// Spec đầy đủ: hsb-material-app/docs/SPEC_OT_XUAT_TRA_KHO.md
//
// 1 component dùng cho CẢ Xuất kho lẫn Trả kho (khác nhau ở `kind`), mỗi cái có
// 2 nhánh Nguyên liệu / Phụ liệu — đúng cấu trúc user chốt.

import { useCallback, useEffect, useMemo, useState } from 'react';
import BarcodeScanButton from './BarcodeScanButton';
import {
  BRANCH_LABEL, DEPARTMENTS, KIND_LABEL, defaultDepartment,
  type Branch, type Department, type Kind, type SlipLine,
  type StockAux, type StockCoil,
} from '@/lib/nvl-slips';

type MasterNvl = { id: number; code: string; name: string; size: string; unit: string };

type Slip = {
  id: string; uid: string; slip_date: string; seq: number; status: string;
  note: string | null; reject_reason: string | null;
  approved_at: string | null; approved_by: string | null;
  main_refs: Array<{ no: string; department: string }>;
  line_errors: Array<{ seq: number; code?: string; error: string }>;
  created_by_name: string | null;
};

type SlipEvent = { at: string; actor: string | null; action: string; detail: Record<string, unknown> };

const fmtQty = (n: number) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: 3 });

// Nhấn mạnh thông tin người dùng cần đọc nhanh nhất khi đứng ở kho (user 28/7):
// Loại NVL · size/quy cách · số Kg từng cuộn → đậm, màu cam.
const EMPH = 'font-bold text-orange-600';

// Nền phân biệt từng ĐỢT NHẬP KHO (user 28/7) — cuộn cùng ngày về cùng một màu.
// Xoay vòng 5 tông nhạt; KHÔNG dùng tông đỏ/hồng vì đã dành cho lỗi & hết tồn.
const GROUP_STYLE = [
  { bg: 'bg-sky-50', chip: 'bg-sky-600' },
  { bg: 'bg-emerald-50', chip: 'bg-emerald-600' },
  { bg: 'bg-amber-50', chip: 'bg-amber-600' },
  { bg: 'bg-violet-50', chip: 'bg-violet-600' },
  { bg: 'bg-teal-50', chip: 'bg-teal-600' },
];

function hhmmVN() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);
}

/** Ngày VN dạng YYYY-MM-DD (máy nhân viên có thể lệch múi giờ). */
function todayVN() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → 'DD/MM'. Chuỗi ngày thuần (không giờ) nên KHÔNG quy múi giờ. */
function ddmm(iso?: string | null): string {
  if (!iso || iso.length < 10) return '';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  draft: { label: '📝 Đang ghi (chưa gửi)', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  pending: { label: '📤 Đã gửi — chờ duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  approved: { label: '✅ Đã duyệt — tồn đã trừ', cls: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  rejected: { label: '❌ Bị từ chối', cls: 'bg-rose-50 text-rose-800 border-rose-300' },
};

export default function WarehouseSlipView({ kind }: { kind: Kind }) {
  const [branch, setBranch] = useState<Branch>('nvl');
  // Ngày đang xem — mặc định hôm nay. Xem ngày khác thì CHỈ ĐỌC (user 28/7):
  // ô soạn luôn ghi vào phiếu của HÔM NAY nên không được sửa phiếu ngày cũ ở đây.
  const [viewDate, setViewDate] = useState(todayVN());
  const isToday = viewDate === todayVN();
  const [loadedFor, setLoadedFor] = useState('');
  const loading = loadedFor !== `${kind}|${branch}|${viewDate}`;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [slip, setSlip] = useState<Slip | null>(null);
  // CÁC PHIẾU TRƯỚC trong ngày (đã duyệt, hoặc bị xoá bên app chính) — chỉ để xem
  // lại, tách hẳn khỏi phần đang soạn. Ngày làm nhiều đợt thì xếp thu gọn hết ở đây.
  const [past, setPast] = useState<Array<{ slip: Slip; lines: SlipLine[] }>>([]);
  const [lines, setLines] = useState<SlipLine[]>([]);
  const [events, setEvents] = useState<SlipEvent[]>([]);
  const [slipNote, setSlipNote] = useState('');

  // Tồn app chính đẩy xuống
  const [coils, setCoils] = useState<StockCoil[]>([]);
  const [auxMats, setAuxMats] = useState<StockAux[]>([]);
  const [nvlMaster, setNvlMaster] = useState<MasterNvl[]>([]);
  const [stockAt, setStockAt] = useState<string>('');

  // Form thêm dòng
  const [q, setQ] = useState('');
  const [pickedCode, setPickedCode] = useState('');
  const [dept, setDept] = useState<Department>('Heading');
  const [lineNote, setLineNote] = useState('');
  const [auxQty, setAuxQty] = useState('');
  const [ticked, setTicked] = useState<Record<number, string>>({});   // coil_id → Kg (chuỗi)
  // Kết quả lần quét gần nhất — để BIẾT tem mỗi NCC chứa gì (khảo sát 28/7:
  // 4/5 tem không in giá trị mã vạch nên phải quét thật mới rõ)
  const [scan, setScan] = useState<{
    raw: string; format: string; exact: number; fuzzy: string[]; nFuzzy: number;
  } | null>(null);

  const isNvl = branch === 'nvl';
  const isReturn = kind === 'return';
  // TRẢ kho nguyên liệu tick từ cuộn ĐANG Ở LINE; XUẤT kho tick từ cuộn kho Main
  const stockPart = isReturn ? 'nvl_line' : 'nvl_main';

  const resetForm = useCallback(() => {
    setQ(''); setPickedCode(''); setLineNote(''); setAuxQty(''); setTicked({});
    setScan(null);
  }, []);

  const loadSlip = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch(
        `/api/nvl-slips?kind=${kind}&branch=${branch}&date=${viewDate}`,
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Không tải được phiếu');
      const num = (ls: Array<SlipLine & { qty: string | number }>) =>
        (ls ?? []).map((l) => ({ ...l, qty: Number(l.qty) }));

      const all: Array<{ slip: Slip; lines: SlipLine[] }> =
        (d.slips ?? []).map((s: { slip: Slip; lines: Array<SlipLine & { qty: string | number }> }) => ({
          slip: s.slip, lines: num(s.lines),
        }));
      // Phiếu đang soạn = phiếu seq lớn nhất, TRỪ KHI nó đã duyệt.
      // ⚠ Phiếu ĐÃ DUYỆT phải tách hẳn ra khỏi phần đang ghi (user 28/7).
      // Trước đây giữ chung: 23 dòng đã duyệt vẫn nằm trong ô soạn và nút "Gửi
      // lên app chính" vẫn bấm được → bấm là tạo phiếu MỚI với Y NGUYÊN 23 dòng
      // đó → duyệt tiếp là TRỪ TỒN LẦN HAI. Giờ nó thành khối lịch sử chỉ đọc,
      // còn ô soạn bắt đầu TRỐNG cho đợt mới trong ngày.
      const last = all.length ? all[all.length - 1] : null;
      const editing = last && last.slip.status !== 'approved' ? last : null;
      setPast(editing ? all.slice(0, -1) : all);
      setSlip(editing?.slip ?? null);
      setSlipNote(editing?.slip.note ?? '');
      setLines(editing?.lines ?? []);
      setEvents(d.events ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải phiếu');
    }
  }, [kind, branch, viewDate]);

  const loadStock = useCallback(async () => {
    try {
      const parts = isNvl ? `${stockPart},nvl_master` : 'aux';
      const r = await fetch(`/api/nvl-stock?part=${parts}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Không tải được tồn kho');
      if (isNvl) {
        setCoils((d.parts?.[stockPart]?.payload ?? []) as StockCoil[]);
        setNvlMaster((d.parts?.nvl_master?.payload ?? []) as MasterNvl[]);
        setStockAt(d.parts?.[stockPart]?.pushed_at ?? '');
      } else {
        setAuxMats((d.parts?.aux?.payload ?? []) as StockAux[]);
        setStockAt(d.parts?.aux?.pushed_at ?? '');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải tồn kho');
    }
  }, [isNvl, stockPart]);

  // Không setState đồng bộ trong effect (cascading render) — `loading` suy ra từ
  // "đã nạp xong cho tổ hợp nào", chỉ set sau khi await xong.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadSlip(), loadStock()]);
      if (!cancelled) setLoadedFor(`${kind}|${branch}|${viewDate}`);
    })();
    return () => { cancelled = true; };
  }, [kind, branch, viewDate, loadSlip, loadStock]);

  // ---- Ô gợi ý mã -------------------------------------------------------
  // NVL: gộp cuộn theo mã để hiện "Code – Tên – Size – n cuộn / x kg"
  const nvlOptions = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; size: string; n: number; kg: number }>();
    for (const c of coils) {
      const cur = byCode.get(c.code) ?? { code: c.code, name: c.name, size: c.size, n: 0, kg: 0 };
      cur.n += 1; cur.kg += c.kg;
      byCode.set(c.code, cur);
    }
    // Mã trong master mà không còn cuộn nào → vẫn hiện, tồn 0 (để báo hết tồn)
    for (const m of nvlMaster) {
      if (!byCode.has(m.code)) {
        byCode.set(m.code, { code: m.code, name: m.name, size: m.size, n: 0, kg: 0 });
      }
    }
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [coils, nvlMaster]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    if (isNvl) {
      return nvlOptions
        .filter((o) => `${o.code} ${o.name} ${o.size}`.toLowerCase().includes(s))
        .slice(0, 20);
    }
    return auxMats
      .filter((m) => `${m.code} ${m.name} ${m.material} ${m.spec}`.toLowerCase().includes(s))
      .slice(0, 20);
  }, [q, isNvl, nvlOptions, auxMats]);

  const pickedNvl = useMemo(
    () => nvlOptions.find((o) => o.code === pickedCode) ?? null,
    [nvlOptions, pickedCode],
  );
  const pickedAux = useMemo(
    () => auxMats.find((m) => m.code === pickedCode) ?? null,
    [auxMats, pickedCode],
  );

  // Cuộn của mã đang chọn, trừ cuộn đã nằm trong phiếu
  // Gồm cả cuộn của phiếu ĐÃ DUYỆT hôm nay: snapshot tồn có thể chưa kịp làm mới
  // (agent đẩy sau ~60s) nên cuộn vừa xuất vẫn còn trong danh sách — chặn tick lại.
  // Ngoại lệ: phiếu cũ bị XOÁ bên app chính (về `draft`) thì cuộn đã quay lại kho
  // Main thật → phải cho tick lại, không chặn.
  const usedCoilIds = useMemo(
    () => new Set([
      ...lines.map((l) => l.coil_id),
      ...past
        .filter((p) => p.slip.status === 'approved' || p.slip.status === 'pending')
        .flatMap((p) => p.lines.map((l) => l.coil_id)),
    ].filter(Boolean) as number[]),
    [lines, past],
  );
  // FIFO (user chốt lại 28/7 — bỏ phương án xếp theo Kg): cuộn NHẬP TRƯỚC lên
  // trước. Cùng ngày thì theo id (thứ tự nhập trong phiếu). Cuộn thiếu ngày
  // xuống cuối.
  //   · XUẤT kho: nhóm theo NGÀY NHẬP, cũ nhất lên đầu → đúng tinh thần FIFO.
  //   · TRẢ kho : nhóm theo NGÀY XUẤT RA LINE, MỚI NHẤT lên đầu — cuộn vừa mang
  //     ra line mới là cuộn hay bị trả lại, cuộn ra từ 3 tháng trước thì không.
  const dateOf = useCallback(
    (c: StockCoil) => (isReturn ? c.issued_at : c.received_at) || '',
    [isReturn],
  );

  const coilsOfPicked = useMemo(() => {
    const list = coils.filter((c) => c.code === pickedCode && !usedCoilIds.has(c.id));
    // Cuộn thiếu ngày → coi là ĐỢT SỚM NHẤT, gom về đầu (user 28/7): mấy cuộn
    // đó là tồn lúc chuyển hệ thống nên phải ưu tiên dùng trước, không phải bỏ
    // xuống cuối. Thực tế 28/7 cột received_at không rỗng cuộn nào, đây là
    // phòng hờ cho dữ liệu nhập tay sau này.
    const k = (c: StockCoil) => dateOf(c) || '0000-00-00';
    return list.sort((a, b) => {
      const ka = k(a), kb = k(b);
      if (ka !== kb) return isReturn ? (ka < kb ? 1 : -1) : (ka < kb ? -1 : 1);
      return a.id - b.id;
    });
  }, [coils, pickedCode, usedCoilIds, dateOf, isReturn]);

  // Gom thành từng ĐỢT theo ngày để tô nền phân biệt (user 28/7): 9 cuộn về 3
  // đợt → 3 khối màu khác nhau, nhìn là biết nhóm nào cũ.
  //
  // `opening` = cả khối là cuộn TỒN ĐẦU KỲ lúc chuyển sang hệ thống này. Nhận
  // diện bằng coil_no bắt đầu 'OPN-' — đối chiếu DB thật 28/7 khớp 241/241 cuộn
  // của 7 phiếu OPN-20260423-*, và không có cuộn nào khác mang tiền tố này.
  const coilGroups = useMemo(() => {
    const out: Array<{ date: string; items: StockCoil[]; opening: boolean }> = [];
    for (const c of coilsOfPicked) {
      const d = dateOf(c);
      if (!out.length || out[out.length - 1].date !== d) {
        out.push({ date: d, items: [], opening: false });
      }
      out[out.length - 1].items.push(c);
    }
    for (const g of out) {
      g.opening = !isReturn && g.items.every((c) => (c.coil_no || '').startsWith('OPN-'));
    }
    return out;
  }, [coilsOfPicked, dateOf, isReturn]);

  function pick(code: string, name = '') {
    setPickedCode(code);
    setQ(code);
    setTicked({});
    setAuxQty('');
    setDept(defaultDepartment(branch, code, name));
  }

  // Quét tem → tìm cuộn theo Lot No (hoặc số cuộn) rồi tự tick.
  //
  // ⚠ Khảo sát tem thật 28/7: mỗi NCC in MỘT KIỂU và 4/5 tem KHÔNG in giá trị
  // mã vạch, nên chưa biết chắc mã vạch chứa gì. Vì vậy:
  //   · khớp CHÍNH XÁC thì mới tự tick (khớp sai cuộn = trừ sai tồn)
  //   · khớp mờ (bỏ gạch/khoảng trắng, hoặc chuỗi lồng nhau) chỉ GỢI Ý, không tự tick
  //   · luôn hiện chuỗi thô + loại mã ra màn hình để còn biết tem chứa gì
  const onScan = useCallback(
    (text: string, format?: string) => {
      const raw = text.trim();
      const s = raw.toUpperCase();
      const norm = (x: string) => x.toUpperCase().replace(/[\s\-._/]/g, '');
      const sn = norm(raw);

      const free = coils.filter((c) => !usedCoilIds.has(c.id));
      const exact = free.filter(
        (c) => (c.lot_no || '').toUpperCase() === s || (c.coil_no || '').toUpperCase() === s,
      );
      // Gợi ý: bỏ ký tự phân cách, hoặc lot nằm trong chuỗi quét / ngược lại
      const fuzzy = exact.length
        ? []
        : free.filter((c) => {
            const l = norm(c.lot_no || '');
            const n = norm(c.coil_no || '');
            if (!l && !n) return false;
            return (
              (!!l && (l === sn || (l.length >= 5 && (sn.includes(l) || l.includes(sn))))) ||
              (!!n && (n === sn || (n.length >= 5 && (sn.includes(n) || n.includes(sn)))))
            );
          });

      setScan({
        raw,
        format: format || '?',
        exact: exact.length,
        fuzzy: fuzzy.slice(0, 5).map((c) => `${c.coil_no} · lot ${c.lot_no || '(rỗng)'} · ${c.code}`),
        nFuzzy: fuzzy.length,
      });

      if (exact.length === 0) {
        setErr('');
        setMsg('');
        return;   // panel chẩn đoán bên dưới đã nói rõ, không tick gì
      }
      setErr('');
      const code = exact[0].code;
      setPickedCode(code);
      setQ(code);
      setDept(defaultDepartment(branch, code, exact[0].name));
      if (exact.length === 1) {
        setTicked((t) => ({ ...t, [exact[0].id]: String(exact[0].kg) }));
        setMsg(`Đã tick cuộn ${exact[0].coil_no}`);
      } else {
        setMsg(`${exact.length} cuộn cùng Lot ${s} — tick cuộn đúng bên dưới`);
      }
    },
    [coils, usedCoilIds, branch],
  );

  // ---- Thêm dòng --------------------------------------------------------
  function addLines() {
    setErr(''); setMsg('');
    const batchSeq = lines.length ? Math.max(...lines.map((l) => l.batch_seq)) : 0;
    const nextBatch = batchSeq + (lines.length ? 1 : 1);
    const time = hhmmVN();

    if (isNvl) {
      const ids = Object.keys(ticked).map(Number);
      if (ids.length === 0) { setErr('Chưa tick cuộn nào'); return; }
      const news: SlipLine[] = [];
      for (const id of ids) {
        const c = coils.find((x) => x.id === id);
        if (!c) continue;
        const kg = isReturn ? Number(ticked[id]) || 0 : c.kg;
        if (isReturn && kg <= 0) { setErr(`Cuộn ${c.coil_no}: Kg trả phải > 0`); return; }
        news.push({
          batch_seq: nextBatch, batch_time: time, batch_user: '',
          department: dept,
          material_code: c.code, material_name: c.name, material_spec: c.size,
          coil_id: c.id, coil_no: c.coil_no, lot_no: c.lot_no,
          qty: kg, unit: 'KG', note: lineNote || null,
        });
      }
      if (news.length === 0) { setErr('Không có cuộn hợp lệ'); return; }
      setLines((p) => [...p, ...news]);
    } else {
      if (!pickedAux) { setErr('Chưa chọn mã phụ liệu'); return; }
      const qty = Number(String(auxQty).replace(',', '.'));
      if (!(qty > 0)) { setErr('Số lượng phải lớn hơn 0'); return; }
      if (!isReturn) {
        if (pickedAux.stock <= 0) {
          setErr(`${pickedAux.code}: hết tồn kho — không xuất được`); return;
        }
        const already = lines
          .filter((l) => l.material_code === pickedAux.code)
          .reduce((s, l) => s + l.qty, 0);
        if (already + qty > pickedAux.stock) {
          setErr(
            `Vượt tồn kho: phiếu này đã có ${fmtQty(already)}, thêm ${fmtQty(qty)} ` +
              `> tồn ${fmtQty(pickedAux.stock)} ${pickedAux.unit}`,
          );
          return;
        }
      }
      setLines((p) => [...p, {
        batch_seq: nextBatch, batch_time: time, batch_user: '',
        department: dept,
        material_code: pickedAux.code, material_name: pickedAux.name,
        material_spec: [pickedAux.material, pickedAux.spec].filter(Boolean).join(' · '),
        coil_id: null, coil_no: null, lot_no: null,
        qty, unit: pickedAux.unit, note: lineNote || null,
      }]);
    }
    resetForm();
    setMsg('Đã thêm vào phiếu — nhớ bấm Lưu hoặc Gửi');
  }

  function removeLine(i: number) {
    setLines((p) => p.filter((_, idx) => idx !== i));
  }

  // ---- Lưu / Gửi --------------------------------------------------------
  async function save(send: boolean) {
    if (lines.length === 0) { setErr('Phiếu chưa có dòng nào'); return; }
    setSaving(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/nvl-slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, branch, send, note: slipNote, lines }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lưu thất bại');
      setMsg(
        send
          ? `Đã gửi lên app chính — chờ duyệt (phiếu ${d.uid})`
          : `Đã lưu ${d.n_lines} dòng (chưa gửi)`,
      );
      await loadSlip();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi lưu phiếu');
    } finally {
      setSaving(false);
    }
  }

  // ---- Render -----------------------------------------------------------
  // Bảng chưa tạo (chưa chạy migration 17) → Postgres báo 'relation ... does not exist'
  const needMigration = /does not exist|schema cache|relation/i.test(err);
  const st = slip ? STATUS_UI[slip.status] ?? STATUS_UI.draft : null;
  const batches = useMemo(() => {
    const m = new Map<number, SlipLine[]>();
    lines.forEach((l) => {
      if (!m.has(l.batch_seq)) m.set(l.batch_seq, []);
      m.get(l.batch_seq)!.push(l);
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [lines]);

  return (
    <div className="space-y-4">
      {/* Nhánh Nguyên liệu / Phụ liệu */}
      <div className="grid grid-cols-2 gap-2">
        {(['nvl', 'aux'] as Branch[]).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => { setBranch(b); resetForm(); setMsg(''); setErr(''); }}
            className={`py-2.5 rounded-xl text-sm font-semibold border transition ${
              branch === b
                ? 'bg-brand-teal text-white border-brand-teal shadow-md shadow-brand-teal/30'
                : 'bg-white text-brand-teal border-brand-teal/30'
            }`}
          >
            {BRANCH_LABEL[b]}
          </button>
        ))}
      </div>

      {/* Chọn ngày — xem lại phiếu hôm trước. Ngày khác hôm nay thì CHỈ ĐỌC. */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm font-semibold text-brand-navy">Ngày</label>
        <input
          type="date"
          value={viewDate}
          max={todayVN()}
          onChange={(e) => { setViewDate(e.target.value || todayVN()); resetForm(); setMsg(''); setErr(''); }}
          className="px-3 py-2 border border-gray-300 rounded-md text-brand-navy"
        />
        {!isToday && (
          <button
            type="button"
            onClick={() => { setViewDate(todayVN()); resetForm(); setMsg(''); setErr(''); }}
            className="px-3 py-2 rounded-lg bg-brand-teal text-white text-sm font-semibold"
          >
            ↩ Về hôm nay
          </button>
        )}
      </div>

      {!isToday && (
        <div className="rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-sm p-2.5">
          Đang xem lại phiếu ngày <b>{ddmm(viewDate)}</b> — <b>chỉ để xem</b>, không
          ghi thêm được. Muốn ghi thì bấm “Về hôm nay”.
        </div>
      )}

      {loading && <p className="text-sm text-brand-navy-soft">Đang tải…</p>}

      {/* CÁC PHIẾU TRƯỚC trong ngày — THU GỌN, chỉ đọc. Bấm mới mở chi tiết.
          Tách hẳn khỏi phần soạn bên dưới để không thể gửi lại nhầm.
          Ngày làm nhiều đợt thì mỗi phiếu 1 dòng, cộng tổng cả ngày ở chân. */}
      {past.length > 0 && (
        <div className="space-y-2">
          {past.map(({ slip: s, lines: sl }) => {
            const sst = STATUS_UI[s.status] ?? STATUS_UI.draft;
            const gone = s.status !== 'approved';   // bị xoá/gỡ duyệt bên app chính
            return (
              <details
                key={s.id}
                className={`rounded-xl border overflow-hidden ${sst.cls}`}
              >
                <summary className="cursor-pointer p-3 text-sm">
                  <span className="font-bold">{sst.label}</span>
                  <span>
                    {' · '}phiếu #{s.seq} · {sl.length} dòng ·{' '}
                    {fmtQty(sl.reduce((a, l) => a + l.qty, 0))} {sl[0]?.unit ?? ''}
                  </span>
                  {s.main_refs?.length > 0 && (
                    <span className="block text-xs mt-0.5">
                      Phiếu đã tạo: {s.main_refs.map((r) => `${r.no} (${r.department})`).join(' · ')}
                    </span>
                  )}
                  {gone && (
                    <span className="block text-xs font-semibold mt-0.5">
                      Phiếu này KHÔNG còn trừ tồn bên app chính
                      {s.reject_reason ? ` · ${s.reject_reason}` : ''}
                    </span>
                  )}
                  <span className="block text-xs opacity-80 mt-0.5">Bấm để xem lại</span>
                </summary>
                <ul className="divide-y divide-white bg-white/60">
                  {sl.map((l, i) => (
                    <li key={i} className="px-3 py-1.5 text-sm flex items-start gap-2">
                      <span className="flex-1 min-w-0">
                        <span className="font-mono font-semibold">{l.material_code}</span>
                        <span className="text-brand-navy-soft"> · {l.department}</span>
                        <span className="block text-xs text-brand-navy-soft truncate">
                          {l.material_name}{l.lot_no ? ` · ${l.lot_no}` : ''}
                        </span>
                      </span>
                      <span className={`${EMPH} whitespace-nowrap`}>{fmtQty(l.qty)} {l.unit}</span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}

          {/* Tổng ĐÃ DUYỆT cả ngày — con số nhân viên kho cần khi đối chiếu cuối ngày */}
          {(() => {
            const ok = past.filter((p) => p.slip.status === 'approved');
            if (ok.length < 2) return null;
            const nl = ok.reduce((a, p) => a + p.lines.length, 0);
            const qty = ok.reduce((a, p) => a + p.lines.reduce((b, l) => b + l.qty, 0), 0);
            const unit = ok[0].lines[0]?.unit ?? '';
            return (
              <div className="rounded-xl border border-emerald-400 bg-emerald-100 p-2.5 text-sm font-bold text-emerald-900">
                Tổng đã duyệt {ddmm(viewDate)}: {ok.length} phiếu · {nl} dòng ·{' '}
                <span className="text-orange-700">{fmtQty(qty)} {unit}</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Trạng thái phiếu ĐANG SOẠN / chờ duyệt / bị từ chối */}
      {slip && st && (
        <div className={`rounded-xl border p-3 text-sm ${st.cls}`}>
          <div className="font-bold">{st.label}</div>
          <div className="text-xs mt-0.5">
            {KIND_LABEL[kind]} {BRANCH_LABEL[branch].toLowerCase()} · {slip.slip_date}
            {slip.seq > 1 && ` · phiếu #${slip.seq}`}
            {slip.created_by_name && ` · ${slip.created_by_name}`}
          </div>
          {slip.status === 'rejected' && slip.reject_reason && (
            <div className="mt-1.5 font-semibold">Lý do: {slip.reject_reason}</div>
          )}
          {slip.status === 'approved' && slip.main_refs?.length > 0 && (
            <div className="mt-1.5">
              Phiếu đã tạo:{' '}
              {slip.main_refs.map((r) => `${r.no} (${r.department})`).join(' · ')}
            </div>
          )}
          {slip.line_errors?.length > 0 && (
            <ul className="mt-1.5 list-disc pl-5 text-rose-700">
              {slip.line_errors.map((e, i) => (
                <li key={i}>
                  {e.seq ? `Dòng ${e.seq}: ` : ''}{e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {msg && <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-2.5">{msg}</div>}
      {err && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm p-2.5">
          {needMigration ? (
            <>
              <b>Chưa thiết lập bảng trên Supabase.</b> Cần chạy migration{' '}
              <code className="bg-rose-100 px-1 rounded">docs/sql/17-nvl-slips.sql</code>{' '}
              trên Supabase SQL Editor (mở New Query tab MỚI TRỐNG), rồi tải lại trang.
            </>
          ) : (
            err
          )}
        </div>
      )}


      {/* Thêm dòng — chỉ khi đang ở HÔM NAY */}
      {isToday && (
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-brand-navy">
            ➕ {KIND_LABEL[kind]} {BRANCH_LABEL[branch].toLowerCase()}
          </h3>
          {stockAt && (
            <span className="text-[11px] text-brand-navy-soft">
              {isNvl && isReturn ? 'cuộn ở line lúc ' : 'tồn lúc '}
              {new Date(new Date(stockAt).getTime() + 7 * 3600e3).toISOString().slice(11, 16)}
            </span>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-navy mb-1">
            {isNvl ? 'Mã nguyên liệu' : 'Mã phụ liệu'}
          </label>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPickedCode(''); }}
              placeholder={isNvl ? 'Gõ mã / tên / size…' : 'Gõ mã / tên / quy cách…'}
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-md text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
            {isNvl && <BarcodeScanButton onScan={onScan} />}
          </div>

          {/* Chẩn đoán quét tem — hiện chuỗi THÔ để biết mã vạch từng NCC chứa gì */}
          {isNvl && scan && (
            <div
              className={`mt-2 rounded-lg border p-2.5 text-sm ${
                scan.exact
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <b>🔎 Kết quả quét</b>
                <button
                  type="button"
                  onClick={() => setScan(null)}
                  className="text-xs font-semibold opacity-70"
                >
                  Ẩn
                </button>
              </div>
              <div className="mt-1 font-mono break-all bg-white/70 rounded px-2 py-1">
                {scan.raw || '(rỗng)'}
              </div>
              <div className="mt-1 text-xs">
                Loại mã: <b>{scan.format}</b> · {scan.raw.length} ký tự
              </div>
              {scan.exact > 0 ? (
                <div className="mt-1">✅ Khớp chính xác {scan.exact} cuộn — đã tick giúp anh.</div>
              ) : scan.nFuzzy > 0 ? (
                <div className="mt-1">
                  ⚠ <b>Không khớp chính xác</b>, nhưng gần giống {scan.nFuzzy} cuộn — em
                  KHÔNG tự tick để tránh trừ sai tồn:
                  <ul className="list-disc pl-5 mt-0.5 font-mono text-xs">
                    {scan.fuzzy.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                  Hãy chọn cuộn bằng tay bên dưới.
                </div>
              ) : (
                <div className="mt-1">
                  ❌ Không có cuộn nào trong tồn khớp chuỗi này. Chụp lại màn hình này
                  kèm ảnh tem để đối chiếu — rồi chọn cuộn bằng tay.
                </div>
              )}
            </div>
          )}

          {filtered.length > 0 && !pickedCode && (
            <ul className="mt-1 border border-gray-200 rounded-md divide-y max-h-64 overflow-auto">
              {isNvl
                ? (filtered as typeof nvlOptions).map((o) => (
                    <li key={o.code}>
                      <button
                        type="button"
                        onClick={() => pick(o.code, o.name)}
                        className="w-full text-left px-3 py-2 text-sm active:bg-brand-teal/10"
                      >
                        <span className="font-mono font-semibold">{o.code}</span>
                        {' — '}
                        {/* Loại NVL + size in ĐẬM MÀU CAM cho dễ nhận (user 28/7) */}
                        <span className={EMPH}>{o.name}</span>
                        {o.size && <> — <span className={EMPH}>{o.size}</span></>}
                        {/* ⚠ Ở tab TRẢ KHO, danh sách là cuộn ĐÃ XUẤT RA LINE
                            (để chọn trả về), KHÔNG phải tồn kho — phải ghi khác
                            nhau, nếu không người đọc hiểu ngược (user 28/7). */}
                        <span className={o.n ? 'text-brand-navy-soft' : 'text-rose-600 font-semibold'}>
                          {' '}—{' '}
                          {o.n
                            ? `${o.n} cuộn ${isReturn ? 'ở line' : 'tồn'} / ${fmtQty(o.kg)} kg`
                            : isReturn
                              ? 'chưa xuất ra line'
                              : 'hết tồn'}
                        </span>
                      </button>
                    </li>
                  ))
                : (filtered as StockAux[]).map((m) => (
                    <li key={m.code}>
                      <button
                        type="button"
                        onClick={() => pick(m.code, m.name)}
                        className="w-full text-left px-3 py-2 text-sm active:bg-brand-teal/10"
                      >
                        <span className="font-mono font-semibold">{m.code}</span>
                        {' — '}
                        <span className={EMPH}>{m.name}</span>
                        {m.material && <> — <span className={EMPH}>{m.material}</span></>}
                        {m.spec && <> — <span className={EMPH}>{m.spec}</span></>}
                        {/* TRẢ kho phụ liệu KHÔNG phụ thuộc tồn (trả là cộng vào
                            tồn) → tồn 0 vẫn trả được, đừng tô đỏ "hết tồn kho"
                            làm người dùng tưởng bị chặn. */}
                        <span
                          className={
                            isReturn || m.stock > 0
                              ? 'text-brand-navy-soft'
                              : 'text-rose-600 font-semibold'
                          }
                        >
                          {' '}—{' '}
                          {isReturn
                            ? `tồn hiện tại ${fmtQty(m.stock)} ${m.unit}`
                            : m.stock > 0
                              ? `tồn ${fmtQty(m.stock)} ${m.unit}`
                              : 'hết tồn kho'}
                        </span>
                      </button>
                    </li>
                  ))}
            </ul>
          )}
        </div>

        {/* Nguyên liệu: tick cuộn */}
        {isNvl && pickedCode && (
          <div>
            {/* Ô nhập chỉ còn hiện MÃ sau khi chọn → nhắc lại Loại NVL + size ở
                đây, đậm màu cam, để người ở kho không phải mở lại danh sách. */}
            <div className="text-sm font-semibold text-brand-navy mb-1">
              Chọn cuộn
              {pickedNvl && (
                <>
                  {' — '}<span className={EMPH}>{pickedNvl.name}</span>
                  {pickedNvl.size && <> · <span className={EMPH}>{pickedNvl.size}</span></>}
                  <span className="font-normal text-brand-navy-soft">
                    {' '}({coilsOfPicked.length} cuộn{isReturn ? ' ở line' : ''})
                  </span>
                </>
              )}
            </div>
            {coilsOfPicked.length === 0 ? (
              <p className="text-sm text-rose-600 font-semibold">
                {isReturn
                  ? 'Không có cuộn nào của mã này đang ở line'
                  : 'Mã này hết tồn kho — không xuất được'}
              </p>
            ) : (
              <div className="border border-gray-200 rounded-md max-h-80 overflow-auto">
                {coilGroups.map((g, gi) => {
                  const st = GROUP_STYLE[gi % GROUP_STYLE.length];
                  const totalKg = g.items.reduce((s, x) => s + x.kg, 0);
                  return (
                    <div key={`${g.date}-${gi}`} className={st.bg}>
                      {/* Đầu mỗi đợt: ngày + số cuộn. Có nhãn chữ chứ không chỉ
                          dựa vào màu — để người phân biệt màu kém vẫn đọc được. */}
                      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-brand-navy border-y border-white/70">
                        <span className={`${st.chip} text-white rounded px-1.5 py-0.5`}>
                          Đợt {gi + 1}
                        </span>
                        <span>
                          {g.opening ? (
                            <>
                              tồn đầu kỳ · chuyển hệ thống
                              {g.date && ` ${ddmm(g.date)}`}
                            </>
                          ) : (
                            <>
                              {isReturn ? 'xuất line ' : 'nhập kho '}
                              {g.date ? ddmm(g.date) : 'chưa rõ ngày'}
                            </>
                          )}
                        </span>
                        {/* Đợt cũ nhất → nhắc dùng trước cho đúng FIFO */}
                        {gi === 0 && coilGroups.length > 1 && !isReturn && (
                          <span className="text-orange-700 font-bold">← dùng trước</span>
                        )}
                        <span className="ml-auto font-normal text-brand-navy-soft">
                          {g.items.length} cuộn · {fmtQty(totalKg)} kg
                        </span>
                      </div>
                      <ul className="divide-y divide-white/70">
                {g.items.map((c) => {
                  const on = ticked[c.id] !== undefined;
                  return (
                    <li key={c.id} className="px-3 py-2 text-sm">
                      {/* Ô tích nằm CUỐI, sau số Kg — ngón tay thao tác từ phải
                          sang cho dễ (user 28/7). Cả dòng vẫn là <label> nên
                          bấm chỗ nào cũng tick được. */}
                      <label className="flex items-center gap-2">
                        {/* CHỈ 1 cột định danh (user 28/7): với phần lớn cuộn
                            NCC thì coil_no TRÙNG Y HỆT lot_no (vd Daeho
                            B8CS02-60400-10) nên hiện cả hai là lặp vô ích và
                            đẩy dòng xuống 2 hàng trên điện thoại.
                            Ưu tiên Lot No; cuộn không có lot (tồn đầu kỳ) thì
                            hiện số cuộn nội bộ để dòng vẫn có định danh. */}
                        <span className="flex-1 min-w-0 font-mono break-all">
                          {c.lot_no || c.coil_no}
                        </span>
                        <span className={`${EMPH} whitespace-nowrap tabular-nums`}>
                          {fmtQty(c.kg)} kg
                        </span>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setTicked((t) => {
                              const n = { ...t };
                              if (e.target.checked) n[c.id] = String(c.kg);
                              else delete n[c.id];
                              return n;
                            })
                          }
                          className="w-6 h-6 shrink-0"
                        />
                      </label>
                      {/* Trả kho: sửa được Kg cân thực khi trả cuộn dở */}
                      {on && isReturn && (
                        <div className="mt-1 pl-7 flex items-center gap-2">
                          <span className="text-xs text-brand-navy-soft">Kg trả</span>
                          <input
                            inputMode="decimal"
                            value={ticked[c.id]}
                            onChange={(e) =>
                              setTicked((t) => ({ ...t, [c.id]: e.target.value }))
                            }
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span className="text-xs text-brand-navy-soft">
                            (nguyên cuộn {fmtQty(c.kg)})
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Phụ liệu: nhập số lượng */}
        {!isNvl && pickedAux && (
          <div>
            <label className="block text-sm font-semibold text-brand-navy mb-1">
              <span className={EMPH}>{pickedAux.name}</span>
              {pickedAux.material && <> · <span className={EMPH}>{pickedAux.material}</span></>}
              {pickedAux.spec && <> · <span className={EMPH}>{pickedAux.spec}</span></>}
              <br />
              {isReturn ? 'Số lượng trả' : 'Số lượng xuất'} ({pickedAux.unit})
              {' — tồn hiện tại '}
              <span className={EMPH}>{fmtQty(pickedAux.stock)}</span>
              {isReturn && (
                <span className="font-normal text-brand-navy-soft">
                  {' '}(trả về sẽ cộng thêm vào tồn)
                </span>
              )}
            </label>
            <input
              inputMode="decimal"
              value={auxQty}
              onChange={(e) => setAuxQty(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md"
            />
            {!isReturn && pickedAux.stock <= 0 && (
              <p className="mt-1 text-sm text-rose-600 font-semibold">
                Hết tồn kho — không xuất được
              </p>
            )}
          </div>
        )}

        {pickedCode && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-1">Bộ phận</label>
                <select
                  value={dept}
                  onChange={(e) => setDept(e.target.value as Department)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md bg-white"
                >
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-1">Ghi chú</label>
                <input
                  value={lineNote}
                  onChange={(e) => setLineNote(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={addLines}
              className="w-full py-3 rounded-xl bg-brand-teal text-white font-bold active:scale-95 transition"
            >
              ➕ Thêm vào phiếu
            </button>
          </>
        )}
      </div>

      )}

      {/* Dòng đã có */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4">
        <h3 className="font-bold text-brand-navy mb-2">
          {past.length > 0
            ? `Phiếu mới #${slip?.seq ?? past[past.length - 1].slip.seq + 1}`
            : 'Phiếu hôm nay'}
          {' — '}{lines.length} dòng
          {lines.length > 0 && ` · ${fmtQty(lines.reduce((s, l) => s + l.qty, 0))} ${lines[0].unit}`}
        </h3>
        {lines.length === 0 ? (
          <p className="text-sm text-brand-navy-soft">Chưa có dòng nào.</p>
        ) : (
          batches.map(([bseq, bl]) => (
            <div key={bseq} className="mb-3">
              <div className="text-xs font-semibold text-brand-navy-soft mb-1">
                Đợt {bseq} · {bl[0].batch_time} · {bl.length} dòng
              </div>
              <ul className="divide-y border border-gray-100 rounded-md">
                {bl.map((l) => {
                  const i = lines.indexOf(l);
                  return (
                    <li key={i} className="px-2.5 py-2 text-sm flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div>
                          <span className="font-mono font-semibold">{l.material_code}</span>
                          <span className="text-brand-navy-soft"> · {l.department}</span>
                        </div>
                        <div className="text-xs text-brand-navy-soft truncate">
                          {l.material_name}
                          {l.coil_no && ` · ${l.coil_no}`}
                          {l.lot_no && ` · ${l.lot_no}`}
                          {l.note && ` · ${l.note}`}
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="font-semibold">{fmtQty(l.qty)} {l.unit}</div>
                        {(
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="text-xs text-rose-600 font-semibold"
                          >
                            Xoá
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}

        <label className="block text-sm font-semibold text-brand-navy mt-3 mb-1">
          Ghi chú phiếu
        </label>
        <input
          value={slipNote}
          onChange={(e) => setSlipNote(e.target.value)}
          disabled={!isToday}
          placeholder="Ghi chú sẽ hiện lên phiếu bên app chính"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-md"
        />

        <div className={`grid grid-cols-2 gap-2 mt-3 ${isToday ? '' : 'hidden'}`}>
          <button
            type="button"
            disabled={saving || lines.length === 0 || !isToday}
            onClick={() => save(false)}
            className="py-3 rounded-xl border border-brand-navy text-brand-navy font-bold disabled:opacity-40"
          >
            💾 Lưu
          </button>
          <button
            type="button"
            disabled={saving || lines.length === 0 || !isToday}
            onClick={() => save(true)}
            className="py-3 rounded-xl bg-brand-navy text-white font-bold disabled:opacity-40"
          >
            📤 Gửi lên app chính
          </button>
        </div>
        <p className="mt-2 text-[11px] text-brand-navy-soft">
          Quên bấm Gửi thì cuối ngày (16:15) máy tự gửi giúp. Tồn kho chỉ thay đổi khi
          app chính duyệt.
        </p>
      </div>

      {/* Lịch sử */}
      {events.length > 0 && (
        <details className="bg-white rounded-xl border border-brand-surface-alt p-4">
          <summary className="font-bold text-brand-navy cursor-pointer">
            Lịch sử chỉnh sửa ({events.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-brand-navy-soft">
            {events.map((e, i) => (
              <li key={i}>
                {new Date(new Date(e.at).getTime() + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ')}
                {' · '}{e.actor || '?'}{' · '}{e.action}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
