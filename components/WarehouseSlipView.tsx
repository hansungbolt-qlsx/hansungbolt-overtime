'use client';

// XUẤT / TRẢ KHO NGUYÊN PHỤ LIỆU trên điện thoại (28/07/2026).
//
// Nguyên tắc nền: app chính là CHỦ KHO DUY NHẤT. Màn này chỉ GHI YÊU CẦU —
// bấm Gửi thì agent đẩy sang app chính, người duyệt bấm Duyệt thì tồn mới đổi.
// Spec đầy đủ: hsb-material-app/docs/SPEC_OT_XUAT_TRA_KHO.md
//
// 1 component dùng cho CẢ Xuất kho lẫn Trả kho (khác nhau ở `kind`), mỗi cái có
// 2 nhánh Nguyên liệu / Phụ liệu — đúng cấu trúc user chốt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BarcodeScanButton from './BarcodeScanButton';
import TempSlipPanel from './TempSlipPanel';
import {
  BRANCH_LABEL, DEPARTMENTS, KIND_LABEL, RETURN_REASONS, RETURN_REASON_DEFAULT,
  RETURN_REASON_OTHER, canhBaoChuaLuu, chanNeuChuaLuu, defaultDepartment,
  demDongChuaLuu, matchAux, matchNvl, supShort,
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

export default function WarehouseSlipView(
  { kind, onChuaLuu }: { kind: Kind; onChuaLuu?: (canhBao: string) => void },
) {
  const [branch, setBranch] = useState<Branch>('nvl');
  // Ngày đang xem — mặc định hôm nay. Xem ngày khác thì CHỈ ĐỌC (user 28/7):
  // ô soạn luôn ghi vào phiếu của HÔM NAY nên không được sửa phiếu ngày cũ ở đây.
  const [viewDate, setViewDate] = useState(todayVN());
  const isToday = viewDate === todayVN();
  const [loadedFor, setLoadedFor] = useState('');
  const loading = loadedFor !== `${kind}|${branch}|${viewDate}`;

  /**
   * BỐI CẢNH ĐANG MỞ (Xuất/Trả × NVL/Phụ liệu × ngày) — dùng để VỨT phản hồi VỀ MUỘN.
   *
   * 🪤 Vá lỗi THẬT 18/08/2026 — phiếu `ot-2026-08-18-issue-aux-1` sinh ra mang
   * **16 dòng NGUYÊN LIỆU**, y hệt sự cố 08/08 nhưng theo đường khác.
   * Bản vá 10/08 (`xoaBoiCanh` dốc rổ khi đổi nhánh) làm ĐÚNG phần của nó. Cái
   * còn thiếu: `loadSlip()`/`loadStock()` KHÔNG có cách huỷ, nên gói của nhánh
   * CŨ về sau vẫn `setLines(...)` đè lên rổ vừa dốc.
   *
   * Diễn biến thật (nhật ký máy chủ): 13:2x anh Cường MỞ LẠI màn Xuất kho —
   * màn luôn mở ở nhánh Nguyên liệu và nạp gói NẶNG (phiếu 16 dòng + cuộn tồn +
   * master + KHSX). Anh bấm ngay sang Phụ liệu; gói phụ liệu NHẸ về trước, gói
   * nguyên liệu về sau và đổ 16 dòng NVL vào rổ. 13:22 anh thêm 1 dòng phụ liệu
   * — đợt của nó là **8** = max(7)+1, đúng dấu vân tay rổ chưa sạch. 13:23 bấm
   * Lưu ⇒ 17 dòng vào phiếu phụ liệu.
   * ⚠ KHÔNG cần mạng chập chờn: gói NVL vốn nặng hơn gói phụ liệu nhiều lần.
   * Lần lưu NVL gần nhất trước đó là **10:35** — cách gần 3 tiếng, nên đây KHÔNG
   * phải chuyện "lưu xong rồi đổi tab".
   *
   * Gán NGAY trong lúc render (không qua `useEffect`) để lúc hiệu ứng nạp của
   * nhánh mới chạy thì dấu đã là nhánh mới — khỏi phụ thuộc thứ tự các hiệu ứng.
   */
  const boiCanh = `${kind}|${branch}|${viewDate}`;
  const boiCanhRef = useRef(boiCanh);
  boiCanhRef.current = boiCanh;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [slip, setSlip] = useState<Slip | null>(null);
  // CÁC PHIẾU TRƯỚC trong ngày (đã duyệt, hoặc bị xoá bên app chính) — chỉ để xem
  // lại, tách hẳn khỏi phần đang soạn. Ngày làm nhiều đợt thì xếp thu gọn hết ở đây.
  const [past, setPast] = useState<Array<{ slip: Slip; lines: SlipLine[] }>>([]);
  const [lines, setLines] = useState<SlipLine[]>([]);
  /**
   * Số dòng MÁY CHỦ đang có, theo lần nạp gần nhất. Gửi kèm mỗi lần Lưu để máy
   * chủ đối chiếu (xem khối "CHỐT PHIÊN BẢN" trong `app/api/nvl-slips/route.ts`).
   *
   * `null` = CHƯA nạp được phiếu ⇒ CẤM lưu. Đây là chốt then chốt của vá 13/08:
   * `loading` KHÔNG bắt được ca này, vì `loadSlip()` tự nuốt lỗi trong `catch`
   * còn effect vẫn đặt `loadedFor` sau `Promise.all` ⇒ `loading` về false kể cả
   * khi nạp THẤT BẠI. Lúc đó rổ rỗng mà nút Lưu vẫn bấm được — đúng ca 10:46:53
   * ngày 13/08 làm mất 27 dòng / 7.192 Kg.
   */
  const [srvCount, setSrvCount] = useState<number | null>(null);
  /**
   * Giỏ có thay đổi CHƯA gửi lên máy chủ hay chưa (vá 14/08/2026).
   * Bật khi thêm/xoá dòng · tắt sau mỗi lần nạp lại thành công (nạp lại chạy
   * ngay sau khi Lưu xong, nên Lưu thành công cũng tắt cờ này).
   */
  const [chuaLuu, setChuaLuu] = useState(false);
  const [events, setEvents] = useState<SlipEvent[]>([]);
  const [slipNote, setSlipNote] = useState('');
  /**
   * CUỘN ĐANG BỊ GIỮ CHỖ bởi phiếu CHƯA KHÉP (chờ duyệt / nháp) của MỌI NGÀY —
   * anh Hữu chốt 21/08/2026 sau sự cố 20/08 (cuộn MAN-12 bị tick lần hai).
   * Máy chủ tính, xem khối chú thích dài ở `app/api/nvl-slips/route.ts`.
   *
   * `heldPartial = true` nghĩa là máy chủ KHÔNG đếm chắc được (đụng trần 1.000
   * dòng của PostgREST, hoặc hỏi hỏng) ⇒ luật 2: KHÔNG GIẤU GÌ CẢ + báo đỏ.
   */
  const [heldCoilIds, setHeldCoilIds] = useState<number[]>([]);
  /** Phụ liệu không có lot/cuộn → giữ chỗ bằng SỐ LƯỢNG cộng dồn theo mã hàng. */
  const [heldAuxQty, setHeldAuxQty] = useState<Record<string, number>>({});
  const [heldPartial, setHeldPartial] = useState(false);

  // Tồn app chính đẩy xuống
  const [coils, setCoils] = useState<StockCoil[]>([]);
  // Mã NVL trong KHSX hôm nay (user 30/7) — cảnh báo mềm khi XUẤT ngoài kế hoạch.
  // null / has_data=false / khác ngày = KHÔNG cảnh báo (chưa có KHSX hôm nay).
  const [khsx, setKhsx] = useState<{ date: string; has_data: boolean; codes: string[] } | null>(null);
  const [auxMats, setAuxMats] = useState<StockAux[]>([]);
  const [nvlMaster, setNvlMaster] = useState<MasterNvl[]>([]);
  const [stockAt, setStockAt] = useState<string>('');
  // Nhịp tim của agent trên PC (thời điểm nó ghi đè catalog DCCD — mỗi 10 phút,
  // vô điều kiện). Xem khối chú thích ở `app/api/nvl-stock/route.ts`.
  const [agentAt, setAgentAt] = useState<string>('');

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
  // THỨ TỰ tick (user 30/7): dòng trong đợt phải xếp đúng thứ tự tay bấm/quét,
  // như ghi giấy. ⚠ Không dùng Object.keys(ticked) — khoá SỐ bị JS tự sắp tăng
  // dần theo ID cuộn, thứ tự tick mất sạch (đã dính: anh Cường dò phiếu không khớp).
  // Bỏ tick rồi tick lại → cuộn xếp xuống cuối theo lần tick sau cùng.
  const [tickOrder, setTickOrder] = useState<number[]>([]);
  // Mã đang có dòng XUẤT TẠM chờ chốt — khối phiếu tạm báo ngược lên. Dùng để
  // nhắc khi xuất kho thường cùng mã đó, tránh ghi trùng hai nơi (user 31/7).
  const [tempWaitingCodes, setTempWaitingCodes] = useState<string[]>([]);
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
    setTickOrder([]);
    setScan(null);
  }, []);

  /**
   * ĐỔI BỐI CẢNH (nhánh / ngày) ⇒ DỐC RỔ NGAY.
   *
   * 🪤 Vá lỗi THẬT 08/08/2026 — xem `docs/DE-XUAT.md` mục B30.
   * Phiếu `ot-2026-08-08-issue-aux-1` sinh ra đã mang **27 dòng NGUYÊN LIỆU**.
   * Nguyên nhân: `lines` là MỘT rổ dùng chung cho cả 4 tổ hợp (Xuất/Trả ×
   * NVL/Phụ liệu). Đổi tab chỉ đổi `branch`, KHÔNG dốc rổ — mà rổ chỉ được dốc
   * khi `loadSlip()` nạp THÀNH CÔNG. Sáng 08/08 lần nạp tab Phụ liệu không xong
   * (mạng chớp / treo); nhánh `catch` chỉ `setErr()`, không đụng `lines` ⇒ 27
   * dòng NVL nằm lại từ 08:51 tới 11:08 — **hơn 2 giờ**, không phải tranh chấp
   * vài giây. Anh Cường thêm dòng washer vào đúng rổ đó rồi bấm Lưu ⇒ 28 dòng
   * vào phiếu phụ liệu.
   * Bằng chứng khép kín: `batch_seq` của dòng washer = **9** = max(8)+1; nếu nạp
   * thành công thì rổ đã rỗng và nó phải bằng **1**.
   *
   * ⚠ CỐ Ý KHÔNG dốc rổ trong `catch` của `loadSlip`. Sau mỗi lần Lưu, hàm đó
   * chạy lại; nếu lần nạp ĐÓ lỗi mà mình xoá `lines` thì phiếu vừa lưu trông như
   * trống rỗng → người dùng gõ lại từ đầu → **GHI TRÙNG**, tệ hơn lỗi đang vá.
   * Dốc rổ ở ĐÚNG chỗ đổi bối cảnh là đủ: nạp được hay không thì rổ cũng rỗng.
   *
   * ⚠ Không mất dữ liệu: dòng chưa Lưu vốn đã bị mất khi lần nạp thành công ghi
   * đè — nay chỉ mất sớm hơn vài giây, ngay lúc đổi tab.
   *
   * `kind` KHÔNG cần xử ở đây: nó là **prop**, và `RegisterLayout` render hai tab
   * ở hai vị trí khác nhau nên đổi Xuất↔Trả là tháo component rồi dựng lại ⇒
   * state tự về rỗng. Đã kiểm 10/08/2026.
   */
  const xoaBoiCanh = useCallback(() => {
    setLines([]);
    setSlip(null);
    setSlipNote('');
    setPast([]);
    setEvents([]);
    setSrvCount(null);   // chưa biết máy chủ có gì → cấm lưu tới khi nạp xong
    setChuaLuu(false);   // giỏ vừa dốc thì không còn gì chưa lưu để mà tiếc
    // Danh sách cuộn bị giữ chỗ tính theo (loại, nhánh) → đổi nhánh là phải dốc,
    // không thì mang danh sách của nhánh cũ đi giấu cuộn của nhánh mới.
    // An toàn vì `srvCount = null` cũng ẩn luôn khối "Thêm dòng" cho tới khi nạp xong.
    setHeldCoilIds([]);
    setHeldAuxQty({});
    setHeldPartial(false);
  }, []);

  const loadSlip = useCallback(async () => {
    const cua = `${kind}|${branch}|${viewDate}`;    // gói này nạp CHO bối cảnh nào
    setErr('');
    try {
      const r = await fetch(
        `/api/nvl-slips?kind=${kind}&branch=${branch}&date=${viewDate}`,
      );
      const d = await r.json();
      // 🛑 VỀ MUỘN — người dùng đã đổi nhánh/ngày. Bỏ trọn gói này, KHÔNG đụng rổ.
      if (boiCanhRef.current !== cua) return;
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
      // Cuộn bị giữ chỗ bởi phiếu chưa khép (mọi ngày) — máy chủ tính sẵn.
      setHeldCoilIds(Array.isArray(d.held_coil_ids) ? d.held_coil_ids : []);
      setHeldAuxQty(
        d.held_aux_qty && typeof d.held_aux_qty === 'object' ? d.held_aux_qty : {},
      );
      setHeldPartial(d.held_partial === true);
      // Nạp THÀNH CÔNG → ghi mốc đối chiếu. Kể cả khi không có phiếu nào đang
      // soạn thì mốc vẫn là 0 (khác hẳn `null` = chưa biết gì).
      setSrvCount(editing?.lines.length ?? 0);
      // Giỏ vừa được đặt lại đúng bằng bản trên máy chủ ⇒ không còn gì chưa lưu.
      // Nạp lại chạy ngay sau mỗi lần Lưu thành công, nên đây cũng là chỗ tắt cờ
      // sau khi Lưu — khỏi phải nhớ tắt ở hai nơi.
      setChuaLuu(false);
    } catch (e) {
      // Gói của bối cảnh CŨ mà hỏng thì cũng phải im: đặt `srvCount = null` ở đây
      // sẽ khoá oan nút Lưu của nhánh người dùng đang đứng.
      if (boiCanhRef.current !== cua) return;
      setErr(e instanceof Error ? e.message : 'Lỗi tải phiếu');
      // ⚠ Nạp HỎNG → xoá mốc để nút Lưu bị khoá. Cố ý KHÔNG dốc `lines` ở đây
      // (xem chú thích `xoaBoiCanh`): dòng vừa lưu mà biến mất thì người dùng gõ
      // lại từ đầu → ghi trùng. Khoá nút thì an toàn mà không mất gì.
      setSrvCount(null);
    }
  }, [kind, branch, viewDate]);

  const loadStock = useCallback(async () => {
    const cua = `${kind}|${branch}|${viewDate}`;    // cùng luật với `loadSlip`
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

      // 🛑 VỀ MUỘN → bỏ. Không thì danh sách cuộn của nhánh cũ đè lên màn đang mở.
      if (boiCanhRef.current !== cua) return;
      // Nhịp tim của agent — đi kèm chính gói mốc này (xem `nhipTimAgent`).
      setAgentAt(typeof dm.agent_at === 'string' ? dm.agent_at : '');
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
      if (boiCanhRef.current !== cua) return;
      setErr(e instanceof Error ? e.message : 'Lỗi tải tồn kho');
    }
    // `branch` + `viewDate` PHẢI có trong danh sách này — `cua` đọc chúng, thiếu
    // là `cua` mang giá trị cũ và phép so bối cảnh trở thành vô nghĩa.
  }, [isNvl, stockPart, kind, branch, viewDate]);

  // Cảnh báo KHSX chỉ BẬT khi: xuất NVL + có dữ liệu + đúng ngày hôm nay
  // (danh sách của hôm qua mà đem soi hôm nay là báo ảo).
  const khsxActive =
    isNvl && kind === 'issue' && !!khsx?.has_data && khsx.date === todayVN();
  const khsxSet = useMemo(() => new Set(khsx?.codes ?? []), [khsx]);

  // ── VIỆC CÒN DỞ — hai tầng, cả hai đều phải chặn (anh Hữu chốt 14/08 chiều) ──
  //
  // Tầng 1 — đã bấm "➕ Thêm vào phiếu", chưa bấm Lưu  → `soChuaLuu`
  // Tầng 2 — MỚI TICK CUỘN, chưa bấm ➕                → `soDangChon`
  //
  // ⚠ Tầng 2 là chỗ DỄ QUÊN NHẤT và trước 14/08 chiều KHÔNG có gì che: tick xong
  // 5 cuộn thì trong đầu đã là "xong rồi", nút ➕ cảm giác thừa. Đo trên chính bản
  // production: tick 1 cuộn rồi chạm tab khác → 0 cảnh báo, quay lại còn 0 tick.
  // Ở tab TRẢ KHO ổ `ticked` còn giữ cả SỐ KG GÕ TAY từng cuộn ⇒ mất là mất số
  // liệu thật, không chỉ mất công tick.
  const soChuaLuu = demDongChuaLuu(chuaLuu, lines.length, srvCount);
  const soDangChon = isNvl
    ? Object.keys(ticked).length
    // Phụ liệu không có cuộn: việc dở là ô SỐ LƯỢNG vừa gõ. Chỉ chọn mã mà chưa
    // gõ số thì chưa có gì để mất → không chặn, khỏi phiền vô cớ.
    : (auxQty.trim() ? 1 : 0);
  const canhBao = canhBaoChuaLuu(soChuaLuu, soDangChon, isNvl ? 'CUỘN' : 'MỤC');

  // Báo ngược lên `RegisterLayout` để nó chặn được nút chuyển tab — nút đó nằm
  // bên ngoài màn này. Dọn về rỗng khi tháo component, nếu không thì tab kế tiếp
  // thừa hưởng câu cảnh báo cũ và chặn một cách vô cớ.
  useEffect(() => {
    onChuaLuu?.(canhBao);
    return () => onChuaLuu?.('');
  }, [canhBao, onChuaLuu]);

  /** Cửa chung cho mọi thao tác ĐỔI BỐI CẢNH ngay trong màn này. */
  const roiDiDuoc = useCallback(() => chanNeuChuaLuu(canhBao), [canhBao]);

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
  //
  // ⭐ NỚI 21/08/2026 — cuộn của phiếu CHƯA KHÉP thuộc NGÀY KHÁC cũng phải giữ
  // chỗ. Trước đây chỉ soi phiếu cùng ngày nên phiếu chờ duyệt của hôm trước
  // không giữ được cuộn nào ⇒ sáng hôm sau tick lại được (ca MAN-12 ngày 20/08).
  // `heldPartial` = máy chủ đếm không chắc ⇒ KHÔNG GIẤU GÌ CẢ (luật 2 của anh Hữu).
  const usedCoilIds = useMemo(
    () => new Set([
      ...lines.map((l) => l.coil_id),
      ...past
        .filter((p) => p.slip.status === 'approved' || p.slip.status === 'pending')
        .flatMap((p) => p.lines.map((l) => l.coil_id)),
      ...(heldPartial ? [] : heldCoilIds),
    ].filter(Boolean) as number[]),
    [lines, past, heldCoilIds, heldPartial],
  );
  // Số cuộn bị giữ chỗ mà KHÔNG phải do phiếu đang xem — tức là do phiếu chưa
  // khép của ngày khác. Chỉ đếm phần này để câu thông báo không cộng trùng.
  const soCuonBiGiu = useMemo(() => {
    if (heldPartial) return 0;
    const trongTam = new Set([
      ...lines.map((l) => l.coil_id),
      ...past.flatMap((p) => p.lines.map((l) => l.coil_id)),
    ].filter(Boolean) as number[]);
    return heldCoilIds.filter((id) => !trongTam.has(id)).length;
  }, [heldCoilIds, heldPartial, lines, past]);

  /**
   * Số lượng PHỤ LIỆU của mã đang chọn đang bị phiếu CHƯA KHÉP giữ chỗ.
   * ① phiếu chờ duyệt khác trong ngày  ② phiếu chưa khép của NGÀY KHÁC (máy chủ
   * tính sẵn). KHÔNG tính giỏ đang gõ — phần đó người dùng đang nhìn thấy rồi.
   * `heldPartial` = máy chủ đếm không chắc ⇒ không trừ gì, để băng đỏ lo.
   */
  const soLuongBiGiu = useMemo(() => {
    if (isNvl || !pickedCode) return 0;
    const choDuyetHomNay = past
      .filter((p) => p.slip.status === 'pending')
      .flatMap((p) => p.lines)
      .filter((l) => l.material_code === pickedCode)
      .reduce((s, l) => s + l.qty, 0);
    const ngayKhac = heldPartial ? 0 : (heldAuxQty[pickedCode] ?? 0);
    return choDuyetHomNay + ngayKhac;
  }, [isNvl, pickedCode, past, heldAuxQty, heldPartial]);

  /**
   * ⭐ BẢN CHỤP TỒN CÓ ĐÁNG TIN KHÔNG — anh Hữu chốt 21/08/2026.
   *
   * Dòng "tồn lúc HH:MM" vốn ĐÃ CÓ (chữ xám 11px). Sáng 20/08 lúc 07:54 nó hiện
   * đúng "tồn lúc 16:36" — tức bản chụp của CHIỀU HÔM TRƯỚC — nhưng không ai để
   * ý: chữ quá nhỏ, KHÔNG có ngày nên "16:36" chẳng gợi ra là hôm qua, và không
   * đổi màu.
   *
   * 🛑 KHÔNG được báo động theo TUỔI CỦA `pushed_at`. Agent chỉ đẩy khi tồn ĐỔI,
   * nên sáng vắng việc thì mốc cũ hàng giờ là chuyện HỢP LỆ. Claude từng đề nghị
   * ngưỡng "quá 30 phút thì vàng" — SAI, sẽ kêu mỗi buổi sáng yên ả và làm "đỏ
   * mất thiêng". Anh Hữu đã bác đúng lập luận này ngày 20/08.
   *
   * Hai điều kiện DUY NHẤT làm màn hình đỏ — cả hai đều KHÔNG thể báo giả:
   *   ① NHỊP TIM tắt: agent ghi đè catalog DCCD mỗi 10 phút VÔ ĐIỀU KIỆN. Quá
   *      25 phút (2,5 nhịp) không thấy ⇒ agent chắc chắn có vấn đề.
   *   ② Mốc tồn KHÁC NGÀY hôm nay: agent luôn đẩy một phát ngay khi khởi động
   *      (`sweep='start'` → `pushNvlStock(true)`), nên mốc của hôm trước nghĩa là
   *      hôm nay agent CHƯA hề chạy — đúng kịch bản sáng 20/08.
   *
   * `bayGio = 0` cho tới khi component gắn xong — cố ý, để bản dựng trên máy chủ
   * và bản chạy trên máy khách khớp nhau (tránh cảnh báo hydrate).
   */
  const [bayGio, setBayGio] = useState(0);
  useEffect(() => {
    setBayGio(Date.now());
    const t = setInterval(() => setBayGio(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const NGUONG_NHIP_PHUT = 25;      // 2,5 lần nhịp catalog 10 phút
  const tonInfo = useMemo(() => {
    if (!stockAt) return null;
    const t = new Date(stockAt).getTime();
    if (!Number.isFinite(t)) return null;
    const vn = new Date(t + 7 * 3600e3).toISOString();
    const ngay = vn.slice(0, 10);
    const khacNgay = ngay !== todayVN();

    // Nhịp tim: chỉ kết luận khi ĐỌC ĐƯỢC mốc và ĐÃ gắn xong (bayGio > 0).
    const ta = agentAt ? new Date(agentAt).getTime() : NaN;
    const nhipPhut = Number.isFinite(ta) && bayGio > 0
      ? Math.floor((bayGio - ta) / 60_000)
      : null;
    const nhipTat = nhipPhut !== null && nhipPhut > NGUONG_NHIP_PHUT;

    return {
      ngay, gio: vn.slice(11, 16), khacNgay, nhipTat, nhipPhut,
      do: khacNgay || nhipTat,
    };
  }, [stockAt, agentAt, bayGio]);
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
    setTickOrder([]);
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
        // Quét cuộn nào trước → dòng đó đứng trước (cùng luật với tick tay)
        setTickOrder((o) => (o.includes(exact[0].id) ? o : [...o, exact[0].id]));
        setMsg(`Đã tick cuộn ${exact[0].coil_no}`);
      } else {
        setMsg(`${exact.length} cuộn cùng Lot ${s} — tick cuộn đúng bên dưới`);
      }
    },
    [coils, usedCoilIds, branch],
  );

  // ---- Thêm dòng --------------------------------------------------------
  /** Hỏi lại nếu mã đang có dòng xuất tạm chờ chốt. true = cho đi tiếp. */
  function warnTempWaiting(codes: Array<string | null | undefined>): boolean {
    if (kind !== 'issue' || tempWaitingCodes.length === 0) return true;
    const dup = [...new Set(codes.filter((c): c is string => !!c && tempWaitingCodes.includes(c)))];
    if (dup.length === 0) return true;
    return window.confirm(
      `⚠ ${dup.join(', ')} đang có dòng ở PHIẾU XUẤT KHO TẠM chưa chốt.\n\n`
      + 'Kiểm tra kẻo ghi trùng hai nơi cho cùng một lần xuất.\n\nVẫn tiếp tục?',
    );
  }

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
      // Dòng xếp ĐÚNG THỨ TỰ TICK/QUÉT (user 30/7) — không dùng Object.keys
      // (khoá số bị JS sắp theo ID cuộn, mất thứ tự tay bấm). Phòng hờ lệch
      // trạng thái: cuộn có tick mà thiếu trong tickOrder thì nối vào cuối.
      const ordered = tickOrder.filter((id) => ticked[id] !== undefined);
      const ids = [
        ...ordered,
        ...Object.keys(ticked).map(Number).filter((id) => !ordered.includes(id)),
      ];
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
      // Nhắc khỏi ghi trùng hai nơi (user chốt 31/7): mã này đang có dòng xuất
      // tạm chờ chốt. Cuộn thì đã được chặn ở tầng khác (phiếu tạm không gợi ý
      // cuộn đã vào phiếu), đây chỉ là lời nhắc để khỏi ghi thừa rồi phải xoá.
      if (!warnTempWaiting(news.map((n) => n.material_code))) return;
      setLines((p) => [...p, ...news]);
    } else {
      if (!pickedAux) { setErr('Chưa chọn mã phụ liệu'); return; }
      const qty = Number(String(auxQty).replace(',', '.'));
      if (!(qty > 0)) { setErr('Số lượng phải lớn hơn 0'); return; }
      if (!isReturn) {
        if (pickedAux.stock <= 0) {
          setErr(`${pickedAux.code}: hết tồn kho — không xuất được`); return;
        }
        // ⭐ SỬA 21/08 chiều — trước đây chỉ cộng `lines` (GIỎ ĐANG GÕ) rồi so với
        // tồn, nên số lượng đang nằm ở phiếu CHỜ DUYỆT không được trừ ⇒ xuất chồng
        // được, đúng kịch bản 20/08 nhưng cho phụ liệu. Nay cộng đủ ba phần:
        //   ① giỏ đang gõ  ② phiếu CHỜ DUYỆT khác trong ngày  ③ phiếu chưa khép
        //   của NGÀY KHÁC (máy chủ tính sẵn, xem `cuonBiGiuCho`)
        // ⚠ KHÔNG cộng phiếu đã DUYỆT: bản chụp tồn đã trừ rồi, cộng nữa là trừ hai
        //   lần ⇒ chặn oan. Chặn oan tệ hơn phiếu kẹt.
        const already = lines
          .filter((l) => l.material_code === pickedAux.code)
          .reduce((s, l) => s + l.qty, 0);
        const choDuyetHomNay = past
          .filter((p) => p.slip.status === 'pending')
          .flatMap((p) => p.lines)
          .filter((l) => l.material_code === pickedAux.code)
          .reduce((s, l) => s + l.qty, 0);
        // Máy chủ đếm không chắc (đụng trần 1.000 dòng) → KHÔNG trừ, để băng đỏ lo.
        const ngayKhac = heldPartial ? 0 : (heldAuxQty[pickedAux.code] ?? 0);
        const daGiu = choDuyetHomNay + ngayKhac;
        if (already + daGiu + qty > pickedAux.stock) {
          setErr(
            `Vượt tồn kho: phiếu này đã có ${fmtQty(already)}`
            + (daGiu > 0 ? `, phiếu chờ duyệt đang giữ ${fmtQty(daGiu)}` : '')
            + `, thêm ${fmtQty(qty)} > tồn ${fmtQty(pickedAux.stock)} ${pickedAux.unit}`,
          );
          return;
        }
      }
      if (!warnTempWaiting([pickedAux.code])) return;
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
    // Đặt sau if/else nên đúng cho CẢ nguyên liệu lẫn phụ liệu, và chỉ chạy khi
    // đã thêm được thật (mọi nhánh lỗi ở trên đều `return` trước khi tới đây).
    setChuaLuu(true);
    setMsg('Đã thêm vào phiếu — nhớ bấm Lưu hoặc Gửi');
  }

  function removeLine(i: number) {
    setLines((p) => p.filter((_, idx) => idx !== i));
    setChuaLuu(true);
  }

  /**
   * Nhận dòng đã chốt từ PHIẾU XUẤT TẠM → nhập vào phiếu hôm nay (user chốt 31/7).
   *
   * ⚠ LƯU NGAY chứ không chỉ setState: ngay sau khi hàm này trả true, bên kia sẽ
   * đánh dấu dòng tạm là "đã chốt". Nếu chỉ để trong bộ nhớ mà người dùng đóng
   * máy thì dòng tạm mất mà phiếu không có gì — mất dấu hàng đã vào máy.
   * Phiếu hôm nay đã gửi rồi thì API tự mở phiếu mới (seq kế tiếp) — đúng thiết kế.
   */
  async function mergeTempLines(newLines: SlipLine[]): Promise<boolean> {
    if (srvCount === null) {                       // cùng lý do như trong `save()`
      setErr('Chưa tải được phiếu hôm nay — bấm 🔄 Tải lại rồi chốt dòng tạm lại.');
      return false;
    }
    const nextBatch = (lines.length ? Math.max(...lines.map((l) => l.batch_seq)) : 0) + 1;
    const all = [...lines, ...newLines.map((l) => ({ ...l, batch_seq: nextBatch }))];
    try {
      const r = await fetch('/api/nvl-slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, branch, send: false, note: slipNote, lines: all, base_n_lines: srvCount,
        }),
      });
      const d = await r.json();
      if (r.status === 409) {
        await loadSlip();
        throw new Error(d.error || 'Phiếu trên máy chủ đã đổi — đã tải lại giúp anh.');
      }
      if (!r.ok) throw new Error(d.error || 'Lưu thất bại');
      await loadSlip();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi ghi dòng vào phiếu hôm nay');
      return false;
    }
  }

  // ---- Lưu / Gửi --------------------------------------------------------
  async function save(send: boolean) {
    if (lines.length === 0) { setErr('Phiếu chưa có dòng nào'); return; }
    // Vá 13/08/2026: chưa nạp được phiếu thì TUYỆT ĐỐI không lưu — lưu lúc này là
    // gửi lên một rổ thiếu, mà máy chủ lưu bằng cách xoá sạch rồi ghi lại.
    if (srvCount === null) {
      setErr('Chưa tải được phiếu từ máy chủ nên chưa lưu được — bấm 🔄 Tải lại '
           + 'rồi thử lại. Dòng đã lưu trước đó vẫn còn nguyên.');
      return;
    }
    setSaving(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/nvl-slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, branch, send, note: slipNote, lines, base_n_lines: srvCount,
        }),
      });
      const d = await r.json();
      // Máy chủ TỪ CHỐI vì lệch mốc → nạp lại ngay để người dùng thấy bản thật.
      // Không có dòng nào bị xoá ở phía máy chủ.
      if (r.status === 409) {
        await loadSlip();
        throw new Error(d.error || 'Phiếu trên máy chủ đã đổi — đã tải lại giúp anh.');
      }
      if (!r.ok) throw new Error(d.error || 'Lưu thất bại');
      setMsg(
        send
          ? `Đã gửi lên app chính — chờ duyệt (phiếu ${d.uid})`
          : `Đã lưu ${d.n_lines} dòng (chưa gửi)`,
      );
      // Lưu xong nạp lại CẢ PHIẾU LẪN TỒN (thêm 21/08/2026). Trước đây tồn chỉ
      // nạp lúc mở màn / đổi nhánh / đổi ngày, nên tick nhiều đợt trong ngày là
      // đợt sau vẫn dùng bản chụp của đợt đầu.
      // ⚠ Rẻ: `loadStock` hỏi MỐC trước (~100 B), mốc trùng thì không tải gói nào.
      // ⚠ Thật thà về giới hạn: agent nằm im thì mốc không đổi ⇒ bước này không
      //   cứu được gì — cái bắt được ca đó là băng cảnh báo "tồn của ngày ..." .
      await Promise.all([loadSlip(), loadStock()]);
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
            // ⚠ Cửa gây sự cố 08/08 (dòng NVL lạc sang phiếu phụ liệu) và là một
            //   trong hai cửa làm mất 6 dòng S18A ngày 14/08. Hỏi TRƯỚC khi dốc giỏ.
            onClick={() => {
              if (b === branch) return;
              if (!roiDiDuoc()) return;
              setBranch(b); xoaBoiCanh(); resetForm(); setMsg(''); setErr('');
            }}
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
          onChange={(e) => {
            const d = e.target.value || todayVN();
            if (d === viewDate) return;
            if (!roiDiDuoc()) return;
            setViewDate(d); xoaBoiCanh(); resetForm(); setMsg(''); setErr('');
          }}
          className="px-3 py-2 border border-gray-300 rounded-md text-brand-navy"
        />
        {/* 🚫 NÚT "↩ Về hôm nay" ĐÃ BỎ — anh Hữu chốt 19/08/2026: bớt một cửa
            đổi bối cảnh thì bớt một chỗ có thể sai. Muốn về hôm nay thì chọn
            ngày hiện tại ngay trên ô ngày bên cạnh — cùng một đường, đã có cửa
            hỏi và dốc rổ y hệt. ĐỪNG dựng lại nút này. */}
      </div>

      {!isToday && (
        <div className="rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-sm p-2.5">
          Đang xem lại phiếu ngày <b>{ddmm(viewDate)}</b> — <b>chỉ để xem</b>, không
          sửa và không ghi thêm được. Muốn ghi thì <b>chọn ngày hôm nay</b> ở ô ngày
          phía trên.
        </div>
      )}

      {/* PHIẾU BỊ TỪ CHỐI CỦA NGÀY CŨ — anh Hữu chốt 19/08/2026 phải nói thẳng.
          Vì sao cần: hai luật của chính app đá nhau —
            · 28/07: xem ngày khác hôm nay = CHỈ ĐỌC (ô soạn luôn ghi vào phiếu HÔM NAY)
            · 29/07: phiếu bị TỪ CHỐI thì mở lại để sửa rồi gửi lại
          Luật sau ngầm giả định phiếu là của hôm nay. Phiếu gửi 18/08 mà sáng 19/08
          mới bị từ chối thì KHÔNG AI SỬA ĐƯỢC — đúng ca đã xảy ra. App phải nói ra
          điều đó thay vì để người dùng xoá một hồi rồi mới phát hiện không lưu được. */}
      {!isToday && slip?.status === 'rejected' && (
        <div className="rounded-lg bg-rose-50 border-2 border-rose-300 text-rose-900 text-sm p-3">
          <b>Phiếu này bị từ chối và là phiếu của ngày cũ — CHỈ XEM, không sửa được.</b>
          <div className="mt-1">
            Muốn xuất lại số hàng này thì <b>chọn ngày hôm nay</b> ở ô ngày phía trên
            rồi <b>tạo phiếu mới</b>. Phiếu cũ cứ để nguyên — nó đã bị từ chối nên
            <b> không trừ tồn kho</b>, chỉ còn là dấu vết.
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-brand-navy-soft">Đang tải…</p>}

      {/* PHIẾU XUẤT KHO TẠM — chỉ có ở XUẤT kho, và chỉ khi đang ở hôm nay
          (xem lại ngày cũ là chỉ đọc). Trả kho không có khái niệm hàng chưa nhập. */}
      {kind === 'issue' && isToday && !loading && (
        <TempSlipPanel
          branch={branch}
          coils={coils}
          auxMats={auxMats}
          nvlMaster={nvlMaster}
          onMerge={mergeTempLines}
          usedCoilIds={usedCoilIds}
          khsxActive={khsxActive}
          khsxSet={khsxSet}
          onWaitingCodes={setTempWaitingCodes}
        />
      )}

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
                  {/* ⭐ THÊM 21/08/2026 — LỖI APP CHÍNH TRẢ VỀ CHO PHIẾU ĐÃ GỬI.
                      App chính soi tồn NGAY khi nhận phiếu (`build_preview`) và
                      trả `line_errors` ngược về đây, nhưng trước bản này màn hình
                      CHỈ vẽ lỗi cho phiếu ĐANG SOẠN. Phiếu đã gửi rơi xuống khối
                      này ⇒ lỗi nằm im không ai thấy: phiếu 20/08 mang 1 lỗi
                      (cuộn MAN-12 đã hết tồn) suốt từ hôm đó tới hôm sau. */}
                  {s.line_errors?.length > 0 && (
                    <span className="block mt-1 rounded-lg bg-red-50 border border-red-300 p-2">
                      <span className="block text-xs font-bold text-red-700">
                        ⚠ App chính báo {s.line_errors.length} dòng có vấn đề — phiếu
                        này KHÔNG duyệt được cho tới khi sửa:
                      </span>
                      {s.line_errors.map((e, i) => (
                        <span key={i} className="block text-xs text-red-700 mt-0.5">
                          {e.seq > 0 ? `Dòng ${e.seq}` : 'Cả phiếu'}
                          {e.code ? ` · ${e.code}` : ''}: {e.error}
                        </span>
                      ))}
                      <span className="block text-xs text-red-700 mt-1">
                        Nhờ người duyệt bấm <b>Từ chối</b> rồi tạo phiếu mới cho đúng.
                      </span>
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


      {/* Vá 13/08/2026 — CHƯA NẠP ĐƯỢC PHIẾU thì che luôn phần thêm dòng.
          Không chỉ khoá nút Lưu: để người dùng gõ xong cả một bó rồi mới báo
          "không lưu được" là bắt họ gõ lại từ đầu. Che sớm + nút Tải lại to rõ.

          ⚠ SỬA 14/08/2026 — PHẢI có `!loading`. Bản 13/08 chỉ soi `srvCount === null`,
          mà `srvCount` KHỞI TẠO bằng null ⇒ khung đỏ này hiện ở MỌI lần mở màn,
          suốt thời gian nạp (~3 giây), kèm dòng chữ "Phiếu hôm nay — 0 dòng".
          Hai cái hại:
            · anh Cường ngày nào cũng thấy phiếu "trống rỗng" rồi tự khỏi sau 3 giây;
            · nên lần nạp HỎNG THẬT trông y hệt lúc bình thường ⇒ chuông báo động
              tự làm mình mất thiêng (trái luật cảnh báo anh Hữu chốt 07/08:
              chỉ in thứ CẦN LÀM).
          `loading` = `loadedFor !== kind|branch|viewDate`, chỉ bật lên sau khi lần
          nạp ĐÃ CHẠY XONG (thành hay bại) ⇒ `!loading && srvCount === null` đúng
          bằng "đã thử nạp và THẤT BẠI". */}
      {isToday && loading && (
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-600 text-sm font-semibold">
          ⏳ Đang tải phiếu hôm nay…
        </div>
      )}
      {isToday && !loading && srvCount === null && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-2">
          <div className="font-bold text-rose-800">⚠ Chưa tải được phiếu hôm nay</div>
          <p className="text-sm text-rose-700 leading-relaxed">
            Mạng chập hoặc máy chủ chưa trả lời. Tạm khoá phần thêm dòng và nút Lưu
            để không ghi đè mất dòng đã lưu trước đó. <b>Dữ liệu cũ vẫn còn nguyên
            trên máy chủ.</b>
          </p>
          <button
            type="button"
            onClick={() => { setErr(''); loadSlip(); }}
            className="px-4 py-2.5 rounded-lg bg-rose-600 text-white font-bold"
          >
            🔄 Tải lại phiếu
          </button>
        </div>
      )}

      {/* Thêm dòng — chỉ khi đang ở HÔM NAY và ĐÃ nạp được phiếu */}
      {isToday && srvCount !== null && (
      <div className="bg-white rounded-xl shadow-sm border border-brand-surface-alt p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-brand-navy">
            ➕ {KIND_LABEL[kind]} {BRANCH_LABEL[branch].toLowerCase()}
          </h3>
          {tonInfo && !tonInfo.do && (
            <span className="text-[11px] text-brand-navy-soft">
              {isNvl && isReturn ? 'cuộn ở line lúc ' : 'tồn lúc '}{tonInfo.gio}
            </span>
          )}
        </div>

        {/* ⭐ BẢN CHỤP TỒN KHÔNG ĐÁNG TIN — xem chú thích dài ở `tonInfo`.
            Chỉ ĐỎ, KHÔNG có mức vàng: hai điều kiện ở đó đều không báo giả được. */}
        {tonInfo?.do && (
          <div className="rounded-lg border border-red-400 bg-red-50 p-2.5 text-red-700">
            <div className="text-sm font-bold">
              {tonInfo.khacNgay
                ? `⚠ ĐANG XEM ${isNvl && isReturn ? 'CUỘN Ở LINE' : 'TỒN KHO'} CỦA NGÀY `
                  + `${tonInfo.ngay.slice(8)}/${tonInfo.ngay.slice(5, 7)} LÚC ${tonInfo.gio}`
                : `⚠ MÁY CHỦ ĐANG NGỪNG ĐẨY TỒN — ${tonInfo.nhipPhut} phút không có tín hiệu`}
            </div>
            <div className="text-xs mt-1">
              {tonInfo.khacNgay
                ? 'Số liệu này KHÔNG phải của hôm nay. Cuộn đã được duyệt xuất sáng '
                  + 'nay vẫn có thể hiện ra ở đây.'
                : `Số liệu đang xem là bản lúc ${tonInfo.gio}, có thể đã cũ.`}
              {' '}Báo anh Hữu kiểm tra máy tính chủ (bật máy xong phải đăng nhập)
              trước khi tích cuộn.
            </div>
          </div>
        )}

        {/* ⭐ CUỘN BỊ GIỮ CHỖ bởi phiếu chưa khép (luật 3 anh Hữu chốt 21/08). */}
        {heldPartial ? (
          <div className="rounded-lg border border-red-400 bg-red-50 p-2.5 text-red-700">
            <div className="text-sm font-bold">
              ⚠ Chưa đếm được cuộn đang nằm ở phiếu chờ duyệt
            </div>
            <div className="text-xs mt-1">
              Đang hiện ĐẦY ĐỦ mọi cuộn — có thể có cuộn đã nằm trong phiếu chờ
              duyệt. Kiểm lại danh sách phiếu chờ duyệt trước khi tích.
            </div>
          </div>
        ) : soCuonBiGiu > 0 ? (
          <div className="text-xs text-brand-navy-soft">
            🔒 {soCuonBiGiu} cuộn đang nằm ở phiếu chờ duyệt — không chọn được
          </div>
        ) : null}

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
                          onChange={(e) => {
                            const on2 = e.target.checked;
                            setTicked((t) => {
                              const n = { ...t };
                              if (on2) n[c.id] = String(c.kg);
                              else delete n[c.id];
                              return n;
                            });
                            setTickOrder((o) =>
                              on2
                                ? (o.includes(c.id) ? o : [...o, c.id])
                                : o.filter((id) => id !== c.id),
                            );
                          }}
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
            {/* ⭐ 21/08 chiều — nói RÕ phần tồn đang bị phiếu chờ duyệt giữ chỗ, để
                người dùng hiểu vì sao "còn tồn 500" mà chỉ xuất được 200. */}
            {!isReturn && soLuongBiGiu > 0 && pickedAux.stock > 0 && (
              <p className="mt-1 text-sm font-semibold text-brand-navy">
                🔒 {fmtQty(soLuongBiGiu)} {pickedAux.unit} đang nằm ở phiếu chờ duyệt
                {' — còn dùng được '}
                <span className={EMPH}>
                  {fmtQty(Math.max(0, pickedAux.stock - soLuongBiGiu))} {pickedAux.unit}
                </span>
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
          {/* ⚠ Anh Hữu chốt 19/08: xem ngày cũ thì TUYỆT ĐỐI không được in chữ
              "hôm nay" — nó làm người dùng tưởng đang sửa phiếu hôm nay. */}
          {past.length > 0
            ? `Phiếu mới #${slip?.seq ?? past[past.length - 1].slip.seq + 1}`
            : (isToday ? 'Phiếu hôm nay' : `Phiếu ngày ${ddmm(viewDate)}`)}
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
                        {/* CHỈ hiện khi đang ở HÔM NAY (anh Hữu chốt 19/08).
                            Xem ngày cũ là chỉ-đọc, mà trước đây vẫn cho bấm Xoá:
                            xoá xong KHÔNG lưu được (ô soạn bị ẩn theo ngày), lại
                            còn bị cửa "còn việc chưa lưu" chặn không cho rời màn
                            ⇒ người dùng KẸT, chỉ thoát được bằng tải lại trang.
                            Đúng chỗ làm anh Cường mất công sáng 19/08. */}
                        {isToday && (
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
            disabled={saving || lines.length === 0 || !isToday || srvCount === null}
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
              disabled={saving || lines.length === 0 || !isToday || srvCount === null}
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
