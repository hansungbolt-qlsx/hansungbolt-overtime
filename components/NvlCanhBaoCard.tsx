'use client';

import { useEffect, useRef, useState } from 'react';
import { MAU_MAC, type NvlCanhBao, type NvlDongB, type NvlNhomA } from '@/lib/nvl-canh-bao';

// Cảnh báo nhầm nguyên liệu theo KHSX hôm nay (anh Hữu 30/10/2026) — đầu trang mọi user HD.
// Thẻ CHỮ (không tải ảnh từ Supabase). Tổ trưởng: "Chia sẻ Zalo" chụp chính khối nội dung
// thành ảnh ngay trên điện thoại — giống thẻ Tăng ca hôm nay.

type Row = { plan_date: string; built_at: string; snap_id: number | null; data: NvlCanhBao };

const SHARE_FONT =
  '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function Chip({ text }: { text: string }) {
  // Chữ thường nền vàng (KHÔNG inline-block): html-to-image chép bề rộng khối đã làm tròn
  // → "HD-4A" bẻ đôi "HD-" / "4A" và đè dòng dưới (ảnh Zalo 30/10). nowrap giữ liền 1 khối.
  return (
    <span
      style={{ background: '#ffe600', fontWeight: 800, color: '#111', borderRadius: 6, padding: '1px 6px', marginRight: 4, whiteSpace: 'nowrap' }}
    >
      {text}
    </span>
  );
}

function SizeTag({ size }: { size: string }) {
  // Size đang so — nhãn nền đen chữ trắng cho nổi (anh Hữu 30/10)
  return (
    <span style={{ background: '#111', color: '#fff', fontWeight: 800, borderRadius: 6, padding: '1px 8px', whiteSpace: 'nowrap' }}>
      Size {size}
    </span>
  );
}

// Nội dung dùng chung: thẻ trên màn hình + khung ẩn 480px để tạo ảnh chia sẻ
function NoiDung({ a, b, gio }: { a: NvlNhomA[]; b: NvlDongB[]; gio: string }) {
  return (
    <>
      <div style={{ color: '#d20000', fontWeight: 800, fontSize: 17, lineHeight: 1.3 }}>
        ⚠ CHÚ Ý TRÁNH NHẦM NGUYÊN LIỆU
      </div>
      <div style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>KHSX {gio}</div>

      <div style={{ fontWeight: 800 }}>
        A. Nhiều máy chạy cùng size nhưng khác loại — NVL chờ ở LINE dễ lấy nhầm
      </div>
      {a.length === 0 && <div style={{ marginLeft: 6 }}>• Hôm nay không có</div>}
      {a.map((g) => (
        <div key={`${g.nhom}-${g.size}`} style={{ marginTop: 6 }}>
          <div style={{ marginLeft: 6 }}>
            • <SizeTag size={g.size} />
          </div>
          {g.mac.map((m, i) => (
            <div key={m.mac} style={{ marginLeft: 24, marginTop: 3 }}>
              <b style={{ color: MAU_MAC[i % MAU_MAC.length], whiteSpace: 'nowrap' }}>{m.mac} →</b>{' '}
              {m.may.map((x) => (
                <Chip key={x} text={x} />
              ))}
            </div>
          ))}
        </div>
      ))}

      <div style={{ fontWeight: 800, marginTop: 10 }}>
        B. Máy đổi mã, cùng size khác loại NVL — kiểm và thay cuộn trước khi Setting
      </div>
      {b.length === 0 && <div style={{ marginLeft: 6 }}>• Hôm nay không có</div>}
      {b.map((x, i) => (
        <div key={`${x.may}-${i}`} style={{ marginLeft: 6, marginTop: 6 }}>
          • <Chip text={x.may} /> <SizeTag size={x.size} />
          <div style={{ marginLeft: 18, marginTop: 3 }}>
            {x.tu.ngay ? `chạy cuối ${x.tu.ngay}: ` : ''}
            {x.tu.ma} <b style={{ color: MAU_MAC[0] }}>{x.tu.mac}</b>
          </div>
          <div style={{ marginLeft: 18 }}>
            → {x.sang.ma} <b style={{ color: MAU_MAC[1] }}>{x.sang.mac}</b>
          </div>
        </div>
      ))}
    </>
  );
}

function gioVN(iso: string): string {
  // built_at app chính gửi dạng 2026-10-30T08:30:35+07:00 → hiện 30/10/2026 08:30 (giờ VN)
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export default function NvlCanhBaoCard({ canShare }: { canShare: boolean }) {
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const noiDungRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/nvl-canh-bao')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRow(d.row ?? null);
        setFailed(Boolean(d.error));
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const data = row?.data;
  // Chưa có cho hôm nay / app chính tính lỗi → báo, KHÔNG hiện danh sách cũ
  if (!row || !data || data.loi || failed) {
    return (
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        ⚠ Chưa có cảnh báo nhầm nguyên liệu cho KHSX hôm nay — báo văn phòng đồng bộ lại KHSX.
      </div>
    );
  }

  const a = data.a ?? [];
  const b = data.b ?? [];
  const coViec = a.length + b.length > 0;
  const gio = gioVN(row.built_at);

  async function handleShare() {
    if (!noiDungRef.current || sharing) return;
    setSharing(true);
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
      const { toBlob } = await import('html-to-image');
      const node = noiDungRef.current;
      const blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
      if (!blob) {
        alert('Không tạo được ảnh để chia sẻ.');
        return;
      }
      const filename = `canh-bao-nvl-${row!.plan_date}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ title: 'Chú ý tránh nhầm nguyên liệu', files: [file] });
          return;
        } catch (e) {
          if ((e as { name?: string })?.name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const el = document.createElement('a');
      el.href = url;
      el.download = filename;
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
      URL.revokeObjectURL(url);
      alert('Đã tải ảnh xuống máy. Mở Zalo, gửi ảnh vào nhóm là xong.');
    } catch (e) {
      console.error('Share error:', e);
      alert('Lỗi khi tạo ảnh. Vui lòng thử lại.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <section className="mb-4 rounded-xl border-2 border-red-300 bg-white shadow-sm overflow-hidden">
      <div style={{ fontFamily: SHARE_FONT, fontSize: 15, lineHeight: 1.6, color: '#141414', padding: '12px 14px' }}>
        <NoiDung a={a} b={b} gio={gio} />
      </div>

      {canShare && coViec && (
        <>
          {/* Khung ẩn rộng cố định 480px — nguồn tạo ảnh, giống thẻ Tăng ca hôm nay: ảnh không
              phụ thuộc bề ngang điện thoại. fixed + opacity 0 để vẫn có kích thước thật. */}
          <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', opacity: 0, zIndex: -1 }}>
            <div
              ref={noiDungRef}
              style={{ width: 480, fontFamily: SHARE_FONT, fontSize: 16, lineHeight: 1.6, color: '#141414', padding: '16px 18px', background: '#fff' }}
            >
              <NoiDung a={a} b={b} gio={gio} />
            </div>
          </div>
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="w-full py-2.5 rounded-lg bg-[#0068ff] hover:bg-[#0055d4] active:scale-95 disabled:opacity-60 disabled:cursor-wait text-white text-sm font-bold shadow-sm transition"
            >
              {sharing ? 'Đang tạo ảnh...' : '📤 Chia sẻ Zalo'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
