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
  BRANCH_LABEL, DEPARTMENTS, KIND_LABEL, RETURN_REASONS, RETURN_REASON_DEFAULT,
  RETURN_REASON_OTHER, defaultDepartment, matchAux, matchNvl, supShort,
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

// Nền phân biệt NHÀ CUNG CẤP (user 28/7) — chỉ bật khi mã đang chọn có từ 2 NCC.
// Tông khác hẳn GROUP_STYLE để không lẫn với màu đợt nhập; vẫn tránh đỏ/hồng.
const SUP_STYLE = [
  { bg: 'bg-indigo-100', chip: 'bg-indigo-600', text: 'text-indigo-800' },
  { bg: 'bg-lime-100', chip: 'bg-lime-700', text: 'text-lime-800' },
  { bg: 'bg-cyan-100', chip: 'bg-cyan-700', text: 'text-cyan-800' },
  { bg: 'bg-fuchsia-100', chip: 'bg-fuchsia-600', text: 'text-fuchsia-800' },
  { bg: 'bg-yellow-100', chip: 'bg-yellow-700', text: 'text-yellow-800' },
  { bg: 'bg-slate-200', chip: 'bg-slate-600', text: 'text-slate-800' },
];

// Màu chữ dòng "Đợt N" trong phiếu đang soạn (user 29/7) — 2 đợt liền nhau phải
// khác màu để nhìn ra ranh giới. Chỉ tô DÒNG ĐỢT, các dòng nội dung giữ nguyên.
// Không dùng đỏ/hồng: đã dành cho nút Xoá và cảnh báo.
const BATCH_TEXT = [
  'text-sky-700',
  'text-emerald-700',
  'text-violet-700',
  'text-teal-700',
  'text-amber-700',
  'text-indigo-700',
];

// ---- Bộ nhớ đệm gói tồn trên máy (user chốt 28/7 tối) ---------------------
// Khoá theo mốc `pushed_at` của app chính: mốc còn nguyên = tồn chưa biến động
// = không tải lại gì. Hỏng/đầy bộ nhớ thì lặng lẽ bỏ qua, chỉ mất phần tiết kiệm
// chứ không bao giờ chặn nhân viên kho làm việc.
const STOCK_CACHE_PREFIX = 'nvlstk:';

function readStockCache(part: string, at: string): unknown[] | null {
  if (typeof window === 'undefined' || !at) return null;
  try {
    const raw = window.localStorage.getItem(STOCK_CACHE_PREFIX + part);
    if (!raw) return null;
    const o = JSON.parse(raw) as { at?: string; payload?: unknown[] };
    return o?.at === at && Array.isArray(o.payload) ? o.payload : null;
  } catch {
    return null;
  }
}

function writeStockCache(part: string, at: string, payload: unknown[]): void {
  if (typeof window === 'undefined' || !at) return;
  try {
    window.localStorage.setItem(STOCK_CACHE_PREFIX + part, JSON.stringify({ at, payload }));
  } catch {
    // Hết chỗ → dọn các gói tồn cũ rồi thử lại đúng 1 lần
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(STOCK_CACHE_PREFIX)) window.localStorage.removeItem(k);
      }
      window.localStorage.setItem(STOCK_CACHE_PREFIX + part, JSON.stringify({ at, payload }));
    } catch {
      /* chịu — lần sau tải lại từ mạng */
    }
  }
}

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
  // Mã NVL trong KHSX hôm nay (user 30/7) — cảnh báo mềm khi XUẤT ngoài kế hoạch.
  // null / has_data=false / khác ngày = KHÔNG cảnh báo (chưa có KHSX hôm nay).
  const [khsx, setKhsx] = useState<{ date: string; has_data: boolean; codes: string[] } | null>(null);
  const [auxMats, setAuxMats] = useState<StockAux[]>([]);
  const [nvlMaster, setNvlMaster] = useState<MasterNvl[]>([]);
  const [stockAt, setStockAt] = useState<string>('');

  // Form thêm dòng
  const [q, setQ] = useState('');
  const [pickedCode, setPickedCode] = useState('');
  const [dept, setDept] = useState<Department>('Heading');
  const [lineNote, setLineNote] = useState('');
  // Lý do TRẢ kho (user chốt 29/7) — chọn theo từng lần "Thêm vào phiếu", nên
  // một phiếu ghi được nhiều lý do; app chính tách phiếu thật theo bộ phận × lý do.
  const [reasonPick, setReasonPick] = useState<string>(RETURN_REASON_DEFAULT);
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
      // Phiếu đang soạn = phiếu seq lớn nhất, VÀ phải còn trong tay nhân viên kho:
      // chỉ 'draft' (đang ghi) hoặc 'rejected' (bị trả về để sửa).
      //
      // ⚠ ĐÃ DUYỆT tách ra (user 28/7): trước đây 23 dòng đã duyệt vẫn nằm trong
      // ô soạn và nút Gửi vẫn bấm được → tạo phiếu mới y nguyên 23 dòng → duyệt
      // tiếp là TRỪ TỒN LẦN HAI.
      // ⚠ ĐÃ GỬI cũng tách ra (user 29/7): phiếu chờ duyệt mà còn sửa được thì
      // người duyệt đọc 2 dòng rồi bấm Duyệt lại trừ 5 dòng. Muốn sửa phải nhờ
      // người duyệt bấm Từ chối → phiếu về 'rejected' → mở lại được.
      const last = all.length ? all[all.length - 1] : null;
      const OPEN = ['draft', 'rejected'];
      const editing = last && OPEN.includes(last.slip.status) ? last : null;
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
      // nvl_khsx chỉ cần cho XUẤT nguyên liệu (user 30/7: trả kho + phụ liệu
      // không cảnh báo) — gói bé (~1 KB) nên đi cùng chuyến hỏi mốc.
      const want = isNvl
        ? [stockPart, 'nvl_master', ...(kind === 'issue' ? ['nvl_khsx'] : [])]
        : ['aux'];

      // ⚠ CHỈ TẢI LẠI KHI TỒN BIẾN ĐỘNG (user chốt 28/7 tối).
      // Hỏi mốc trước (~100 B), trùng mốc đã lưu trong máy thì dùng luôn bản cũ.
      // Trước đây mỗi lần mở màn là tải nguyên gói dù tồn y nguyên: xuất kho
      // 133 KB, trả kho 316 KB — nhân với mấy chục lần mở/ngày là phí thật.
      const rm = await fetch(`/api/nvl-stock?part=${want.join(',')}&meta=1`);
      const dm = await rm.json();
      if (!rm.ok) throw new Error(dm.error || 'Không đọc được mốc tồn kho');

      const cached: Record<string, unknown[]> = {};
      const stale: string[] = [];
      for (const p of want) {
        const at = dm.parts?.[p]?.pushed_at ?? '';
        const hit = at ? readStockCache(p, at) : null;
        if (hit) cached[p] = hit;
        else stale.push(p);
      }
      // Chỉ tải phần đã đổi; cả hai phần còn nguyên thì KHÔNG gọi mạng lần nữa.
      if (stale.length) {
        const r = await fetch(`/api/nvl-stock?part=${stale.join(',')}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Không tải được tồn kho');
        for (const p of stale) {
          const pl = (d.parts?.[p]?.payload ?? []) as unknown[];
          cached[p] = pl;
          writeStockCache(p, d.parts?.[p]?.pushed_at ?? '', pl);
        }
      }

      if (isNvl) {
        setCoils((cached[stockPart] ?? []) as StockCoil[]);
        setNvlMaster((cached.nvl_master ?? []) as MasterNvl[]);
        if (kind === 'issue') {
          const k = (cached.nvl_khsx ?? [])[0] as
            | { date: string; has_data: boolean; codes: string[] }
            | undefined;
          setKhsx(k ?? null);
        }
        setStockAt(dm.parts?.[stockPart]?.pushed_at ?? '');
      } else {
        setAuxMats((cached.aux ?? []) as StockAux[]);
        setStockAt(dm.parts?.aux?.pushed_at ?? '');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải tồn kho');
    }
  }, [isNvl, stockPart, kind]);

  // Cảnh báo KHSX chỉ BẬT khi: xuất NVL + có dữ liệu + đúng ngày hôm nay
  // (danh sách của hôm qua mà đem soi hôm nay là báo ảo).
  const khsxActive =
    isNvl && kind === 'issue' && !!khsx?.has_data && khsx.date === todayVN();
  const khsxSet = useMemo(() => new Set(khsx?.codes ?? []), [khsx]);

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
    const s = q.trim();
    if (!s) return [];
    if (isNvl) {
      // CÒN TỒN lên trước (user 29/7) — mã hết tồn vẫn hiện để báo "hết tồn kho",
      // nhưng không được chiếm chỗ đầu danh sách 20 dòng.
      return nvlOptions
        .filter((o) => matchNvl(s, o.code, o.name, o.size))
        .sort((a, b) => (b.n > 0 ? 1 : 0) - (a.n > 0 ? 1 : 0) || a.code.localeCompare(b.code))
        .slice(0, 20);
    }
    return auxMats
      .filter((m) => matchAux(s, m.code, m.name, m.material, m.spec))
      .sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || a.code.localeCompare(b.code))
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
  // FIFO (user chốt lại 28/7): cuộn NHẬP TRƯỚC lên trước. **Trong cùng một đợt
  // nhập thì xếp Kg TỪ NHỎ ĐẾN LỚN** (user chốt 28/7 17:58) — đợt Daeho 46 cuộn
  // nặng xấp xỉ nhau, xếp theo Kg mới dò ra cuộn cần lấy nhanh. Kg bằng nhau thì
  // theo id (thứ tự nhập trong phiếu). Cuộn thiếu ngày xuống cuối.
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
      if (a.kg !== b.kg) return a.kg - b.kg;   // cùng đợt → Kg nhỏ trước
      return a.id - b.id;
    });
  }, [coils, pickedCode, usedCoilIds, dateOf, isReturn]);

  // Gom thành từng ĐỢT theo ngày để tô nền phân biệt (user 28/7): 9 cuộn về 3
  // đợt → 3 khối màu khác nhau, nhìn là biết nhóm nào cũ.
  //
  // Tra NCC theo số cuộn để hiện viết tắt sau Lot trên dòng phiếu (user 30/7).
  // Cuộn chưa duyệt vẫn nằm trong tồn nên tra được; cuộn đã duyệt (rời tồn)
  // thì thôi không hiện — lúc đó phiếu cũng đã khoá/thu gọn rồi.
  const coilSup = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of coils) {
      if (c.coil_no && c.supplier) m.set(c.coil_no, c.supplier);
    }
    return m;
  }, [coils]);

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

  // NCC của mã đang chọn. Cùng 1 mã mà có ≥2 NCC thì mỗi NCC một màu nền (user
  // 28/7) — dữ liệu thật 28/7 có 4 mã như vậy (02200320/25/30 · 03021262).
  // Xếp theo TÊN để màu của một NCC không nhảy khi danh sách cuộn đổi.
  const supIndex = useMemo(() => {
    const names = [...new Set(coilsOfPicked.map((c) => (c.supplier || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'vi'));
    return new Map(names.map((n, i) => [n, i]));
  }, [coilsOfPicked]);
  const multiSup = supIndex.size >= 2;
  const supStyleOf = useCallback(
    (c: StockCoil) => {
      const i = supIndex.get((c.supplier || '').trim());
      return i === undefined ? null : SUP_STYLE[i % SUP_STYLE.length];
    },
    [supIndex],
  );

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

    // Lý do trả kho: 'Khác' thì lưu chính nội dung người dùng gõ ở ô Ghi chú,
    // và BẮT BUỘC có nội dung (giống app chính: lý do khác phải ghi rõ).
    let reason: string | null = null;
    if (isReturn) {
      if (reasonPick === RETURN_REASON_OTHER) {
        if (!lineNote.trim()) {
          setErr('Chọn "Khác" thì phải ghi rõ lý do vào ô Ghi chú');
          return;
        }
        reason = lineNote.trim();
      } else {
        reason = reasonPick;
      }
    }

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
          qty: kg, unit: 'KG', note: lineNote || null, reason,
        });
      }
      if (news.length === 0) { setErr('Không có cuộn hợp lệ'); return; }
      // ⚠ CẢNH BÁO AN TOÀN (user 30/7): NVL không nằm trong KHSX hôm nay →
      // hỏi xác nhận; đồng ý thì xuất bình thường (cảnh báo mềm, không chặn).
      if (khsxActive) {
        const off = [...new Set(
          news.map((n) => n.material_code).filter((c) => c && !khsxSet.has(c)),
        )];
        if (off.length > 0 && !window.confirm(
          `⚠ CẢNH BÁO AN TOÀN\n\n${off.join(', ')} không có trong KHSX hôm nay.\n\nVẫn tiếp tục xuất?`,
        )) {
          return;
        }
      }
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
        qty, unit: pickedAux.unit, note: lineNote || null, reason,
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
            // 'draft' trong danh sách CŨ = phiếu thật bên app chính đã bị XOÁ.
            // ⚠ Đừng dùng `!== 'approved'`: từ 29/7 phiếu ĐÃ GỬI (pending) cũng
            // nằm ở đây, mà nó thì đang chờ duyệt bình thường chứ không mất gì.
            const gone = s.status === 'draft';
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
                    </span>
                  )}
                  {s.status === 'rejected' && s.reject_reason && (
                    <span className="block text-xs font-semibold mt-0.5">
                      Lý do từ chối: {s.reject_reason}
                    </span>
                  )}
                  {s.status === 'pending' && (
                    <span className="block text-xs mt-0.5">
                      Muốn sửa phiếu này thì nhờ người duyệt bấm Từ chối
                    </span>
                  )}
                  <span className="block text-xs opacity-80 mt-0.5">Bấm để xem lại</span>
                </summary>
                {/* Cùng quy ước với danh sách phiếu đang nhập (user 30/7):
                    NVL — trên: Code · Loại · Size, dưới: Lot (bỏ Heading vì
                    xuất NVL mặc định Heading). Phụ liệu giữ bộ phận. */}
                <ul className="divide-y divide-white bg-white/60">
                  {sl.map((l, i) => (
                    <li key={i} className="px-3 py-1.5 text-sm flex items-start gap-2">
                      {isNvl ? (
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">
                            <span className="font-mono font-semibold">{l.material_code}</span>
                            {l.material_name && (
                              <span className="text-brand-navy-soft"> · {l.material_name}</span>
                            )}
                            {l.material_spec && <span className={EMPH}> · {l.material_spec}</span>}
                          </span>
                          <span className="block text-xs text-brand-navy-soft truncate">
                            Lot: <span className="font-mono">{l.lot_no || l.coil_no || '?'}</span>
                            {isReturn && l.reason ? ` · ${l.reason}` : ''}
                          </span>
                        </span>
                      ) : (
                        <span className="flex-1 min-w-0">
                          <span className="font-mono font-semibold">{l.material_code}</span>
                          <span className="text-brand-navy-soft"> · {l.department}</span>
                          <span className="block text-xs text-brand-navy-soft truncate">
                            {l.material_name}
                            {l.material_spec ? ` · ${l.material_spec}` : ''}
                          </span>
                        </span>
                      )}
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
                        {/* Tồn = 0 tô ĐỎ ở CẢ 2 tab cho dễ nhận biết (user 30/7).
                            Tab TRẢ vẫn ghi "tồn hiện tại 0" (trả là cộng vào tồn,
                            tồn 0 vẫn trả được — màu đỏ chỉ báo hết hàng). */}
                        <span
                          className={
                            m.stock > 0
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
            {/* Cảnh báo sớm NGAY KHI CHỌN MÃ (user 30/7): mã không nằm trong
                KHSX hôm nay — nhắc trước cả khi bấm Thêm vào phiếu. */}
            {khsxActive && pickedCode && !khsxSet.has(pickedCode) && (
              <div className="mb-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-xs font-semibold text-amber-800">
                ⚠ Mã này KHÔNG có trong KHSX hôm nay — kiểm tra lại trước khi xuất.
              </div>
            )}
            {/* Mã có ≥2 NCC → chú thích màu + số cuộn từng nhà, để biết đang
                tick lẫn hàng của 2 nhà hay không (user 28/7). */}
            {multiSup && coilsOfPicked.length > 0 && (
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-bold text-brand-navy">
                  {supIndex.size} nhà cung cấp:
                </span>
                {[...supIndex.keys()].map((n, i) => {
                  const cnt = coilsOfPicked.filter((c) => (c.supplier || '').trim() === n);
                  const st = SUP_STYLE[i % SUP_STYLE.length];
                  return (
                    <span
                      key={n}
                      className={`${st.chip} text-white rounded px-1.5 py-0.5 font-bold`}
                    >
                      {supShort(n)} = {n} · {cnt.length} cuộn ·{' '}
                      {fmtQty(cnt.reduce((s, c) => s + c.kg, 0))} kg
                    </span>
                  );
                })}
                <span className="text-brand-navy-soft">← màu nền dòng = nhà cung cấp</span>
              </div>
            )}
            {/* Chỉ 1 NCC → ghi tên đầy đủ 1 lần ở đây, các dòng dưới chỉ cần viết tắt */}
            {!multiSup && supIndex.size === 1 && (
              <div className="mb-1.5 text-xs text-brand-navy-soft">
                Nhà cung cấp:{' '}
                <span className="font-bold text-brand-navy">
                  {supShort([...supIndex.keys()][0])} = {[...supIndex.keys()][0]}
                </span>
              </div>
            )}
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
                  const sup = (c.supplier || '').trim();
                  const ss = supStyleOf(c);
                  return (
                    <li
                      key={c.id}
                      className={`px-3 py-2 text-sm ${multiSup && ss ? ss.bg : ''}`}
                    >
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
                        {/* Lot No · NCC viết tắt (user 28/7): 1 cuộn PHẢI gọn 1
                            dòng, nên NCC dùng nhãn ngắn (DH/VT/NT/KOS/Korea) và
                            lot dài >16 ký tự thì hạ 1 cỡ chữ. Lot dài nhất trong
                            DB thật là 20 ký tự (20260716-02-N-MAN-19). */}
                        <span className="flex-1 min-w-0">
                          <span
                            className={`font-mono break-all ${
                              (c.lot_no || c.coil_no || '').length > 16 ? 'text-xs' : ''
                            }`}
                          >
                            {c.lot_no || c.coil_no}
                          </span>
                          {sup && (
                            <span
                              className={`ml-1 text-xs font-bold whitespace-nowrap ${
                                multiSup && ss ? ss.text : 'text-brand-navy-soft'
                              }`}
                              title={sup}
                            >
                              · {supShort(sup)}
                            </span>
                          )}
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
            {/* LÝ DO TRẢ KHO (user 29/7) — theo từng lần thêm dòng, nên 1 phiếu
                ghi được nhiều lý do. Xuất kho không có khái niệm này. */}
            {isReturn && (
              <div className="mb-2">
                <label className="block text-sm font-semibold text-brand-navy mb-1">
                  Lý do trả kho
                </label>
                <select
                  value={reasonPick}
                  onChange={(e) => setReasonPick(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md bg-white font-semibold"
                >
                  {RETURN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  <option value={RETURN_REASON_OTHER}>{RETURN_REASON_OTHER} — ghi rõ ở ô Ghi chú</option>
                </select>
              </div>
            )}
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
                <label className="block text-sm font-semibold text-brand-navy mb-1">
                  {isReturn && reasonPick === RETURN_REASON_OTHER ? (
                    <span className="text-orange-600">Ghi chú — bắt buộc</span>
                  ) : 'Ghi chú'}
                </label>
                <input
                  value={lineNote}
                  onChange={(e) => setLineNote(e.target.value)}
                  placeholder={
                    isReturn && reasonPick === RETURN_REASON_OTHER ? 'Ghi rõ lý do trả kho' : ''
                  }
                  className={`w-full px-3 py-2.5 border rounded-md ${
                    isReturn && reasonPick === RETURN_REASON_OTHER && !lineNote.trim()
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-300'
                  }`}
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
              <div className={`text-sm font-bold mb-1 ${BATCH_TEXT[(bseq - 1) % BATCH_TEXT.length]}`}>
                Đợt {bseq} · {bl[0].batch_time} · {bl.length} dòng
              </div>
              <ul className="divide-y border border-gray-100 rounded-md">
                {bl.map((l) => {
                  const i = lines.indexOf(l);
                  return (
                    <li key={i} className="px-2.5 py-2 text-sm flex items-start gap-2">
                      {isNvl ? (
                        /* NVL (user 30/7): mặc định Heading nên KHÔNG hiện bộ phận.
                           Dòng trên: Code · Loại NVL · Size (KG ở cột phải).
                           Dòng dưới: Lot (1 số duy nhất — coil_no với lot_no vốn
                           trùng nhau, hiện cả hai là tràn chữ) + lý do/ghi chú. */
                        <div className="flex-1 min-w-0">
                          <div className="truncate">
                            {/* ⚠ = NVL ngoài KHSX hôm nay (user 30/7, cảnh báo mềm) */}
                            {khsxActive && l.material_code && !khsxSet.has(l.material_code) && (
                              <span title="Không nằm trong KHSX hôm nay">⚠ </span>
                            )}
                            <span className="font-mono font-semibold">{l.material_code}</span>
                            {l.material_name && (
                              <span className="text-brand-navy-soft"> · {l.material_name}</span>
                            )}
                            {l.material_spec && <span className={EMPH}> · {l.material_spec}</span>}
                          </div>
                          <div className="text-xs text-brand-navy-soft truncate">
                            Lot: <span className="font-mono">{l.lot_no || l.coil_no || '?'}</span>
                            {coilSup.has(l.coil_no || '') && (
                              <span className="font-semibold"> · {supShort(coilSup.get(l.coil_no || ''))}</span>
                            )}
                            {isReturn && l.reason && (
                              <span className="font-bold text-orange-600"> · {l.reason}</span>
                            )}
                            {l.note && ` · ${l.note}`}
                          </div>
                        </div>
                      ) : (
                        /* Phụ liệu: giữ bộ phận (Heading/Rolling lẫn nhau) */
                        <div className="flex-1 min-w-0">
                          <div>
                            <span className="font-mono font-semibold">{l.material_code}</span>
                            <span className="text-brand-navy-soft"> · {l.department}</span>
                            {isReturn && l.reason && (
                              <span className="ml-1 text-xs font-bold text-orange-600">
                                · {l.reason}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-brand-navy-soft truncate">
                            {l.material_name}
                            {l.material_spec && ` · ${l.material_spec}`}
                            {l.note && ` · ${l.note}`}
                          </div>
                        </div>
                      )}
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

        {/* User 30/7: LƯU là nút chính — mục tiêu gom cả ngày 1 phiếu, 16:30 máy
            tự gửi. GỬI NGAY thu nhỏ + hỏi xác nhận để không bấm nhầm (gửi xong
            phiếu bị KHÓA, xuất thêm là tách phiếu mới). */}
        <div className={`mt-3 ${isToday ? '' : 'hidden'}`}>
          <button
            type="button"
            disabled={saving || lines.length === 0 || !isToday}
            onClick={() => save(false)}
            className="w-full py-3 rounded-xl bg-brand-navy text-white font-bold disabled:opacity-40"
          >
            💾 Lưu phiếu
          </button>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-brand-navy-soft">
              Không cần bấm gửi — 16:30 máy tự gom cả ngày thành 1 phiếu gửi giúp.
              Tồn kho chỉ thay đổi khi app chính duyệt.
            </p>
            <button
              type="button"
              disabled={saving || lines.length === 0 || !isToday}
              onClick={() => {
                if (
                  window.confirm(
                    'Gửi ngay lên app chính?\n\nGửi xong phiếu sẽ bị KHÓA — nếu xuất/trả thêm sau đó sẽ tách sang phiếu mới.\nBình thường nên để 16:30 máy tự gửi.',
                  )
                )
                  save(true);
              }}
              className="shrink-0 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-500 disabled:opacity-40"
            >
              📤 Gửi ngay
            </button>
          </div>
        </div>
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
