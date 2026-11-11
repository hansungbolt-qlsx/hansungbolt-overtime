import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { vnToday } from '@/lib/co-day';
import {
  KS_BUCKET, KS_PATH, KS_SUA_NGAY, canUseKhoSon, canXuatKhoSon, duocSua, kiemDongKs, soPhieuNgay, tonTam,
  type KsDong, type KsLichSu, type KsPhieu, type KsTon,
} from '@/lib/kho-son';

export const runtime = 'nodejs';

// ============================================================
// KHO SƠN COATING (anh Hữu chốt 11/11/2026). Supabase chỉ là hộp thư: agent nhận phiếu qua Realtime → app chính
// → app chính ghi dòng 'XS-…' vào app Coating → agent ghi trạng thái về (status 'synced').
//   GET   /api/kho-son            → { ton (file app chính), phieu (30 ngày) } — 1 lượt cho cả màn
//   POST  /api/kho-son            → { ngay, lines[{product_id, lot_id, qty, doi_lo_ly_do?, het_han?}] } = Gửi phiếu mới
//   PATCH /api/kho-son            → { so_phieu, version, action: 'sua'|'huy', reason, lines? } — người lập, ≤ 7 ngày
// ============================================================
const COT = 'so_phieu,ngay,status,version,lines,history,cancel_reason,created_by,created_by_name,sent_at,synced_at,main_version,last_error';

async function docTon(): Promise<KsTon | null> {
  const { data, error } = await supabaseAdmin.storage.from(KS_BUCKET).download(KS_PATH);
  if (error || !data) return null;
  try { return JSON.parse(await data.text()) as KsTon; } catch { return null; }
}

async function docPhieu(): Promise<KsPhieu[]> {
  const tu = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabaseAdmin.from('co_paint_slips').select(COT).gte('sent_at', tu)
    .order('sent_at', { ascending: false }).limit(300);
  return (data ?? []) as KsPhieu[];
}

function sachDong(ds: unknown): Omit<KsDong, 'line_id'>[] {
  return (Array.isArray(ds) ? ds : []).map((d: Record<string, unknown>) => ({
    product_id: String(d.product_id || ''), lot_id: String(d.lot_id || ''), qty: Math.round(Number(d.qty) * 1000) / 1000,
    doi_lo_ly_do: d.doi_lo_ly_do ? String(d.doi_lo_ly_do).slice(0, 200) : null,
    het_han: d.het_han ? String(d.het_han).slice(0, 10) : null,
  }));
}

function kiemNgay(ngay: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return 'Ngày xuất không hợp lệ';
  const hom = vnToday();
  if (ngay > hom) return 'Không xuất cho ngày tương lai';
  if ((Date.parse(hom) - Date.parse(ngay)) / 86400_000 > KS_SUA_NGAY) return `Ngày xuất chỉ lùi tối đa ${KS_SUA_NGAY} ngày`;
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session || !canUseKhoSon(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const [ton, phieu] = await Promise.all([docTon(), docPhieu()]);
  return NextResponse.json({ ton, phieu, duoc_xuat: canXuatKhoSon(session) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !canXuatKhoSon(session)) return NextResponse.json({ error: 'Chỉ tổ trưởng Coating được xuất kho' }, { status: 403 });
  let b: { ngay?: string; lines?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 }); }
  const ngay = String(b.ngay || '');
  const ln = kiemNgay(ngay);
  if (ln) return NextResponse.json({ error: ln }, { status: 400 });
  const [ton, phieu] = await Promise.all([docTon(), docPhieu()]);
  if (!ton?.ok) return NextResponse.json({ error: 'Chưa có số tồn từ app chính — thử lại sau ít phút' }, { status: 409 });
  const dong0 = sachDong(b.lines);
  const loi = kiemDongKs(dong0.map((d, i) => ({ ...d, line_id: String(i) })), ton, tonTam(ton, phieu));
  if (loi) return NextResponse.json({ error: loi }, { status: 400 });

  const tien = soPhieuNgay(ngay);
  for (let lan = 0; lan < 4; lan++) {
    const { data: cuoi } = await supabaseAdmin.from('co_paint_slips').select('so_phieu').like('so_phieu', `${tien}%`)
      .order('so_phieu', { ascending: false }).limit(50);
    const max = Math.max(0, ...(cuoi ?? []).map((r) => Number(String(r.so_phieu).slice(tien.length)) || 0));
    const so = `${tien}${String(max + 1).padStart(2, '0')}`;
    const lines: KsDong[] = dong0.map((d, i) => ({ ...d, line_id: `${so}-${i + 1}` }));
    const { error } = await supabaseAdmin.from('co_paint_slips').insert({
      so_phieu: so, ngay, status: 'pending', version: 1, lines, history: [], created_by: session.userId,
      created_by_name: session.fullName || session.username, sent_at: new Date().toISOString(),
    });
    if (!error) return NextResponse.json({ ok: true, so_phieu: so });
    if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });   // trùng số → thử số kế
  }
  return NextResponse.json({ error: 'Không cấp được số phiếu — thử lại' }, { status: 409 });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || !canXuatKhoSon(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  let b: { so_phieu?: string; version?: number; action?: string; reason?: string; lines?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 }); }
  const reason = String(b.reason || '').trim().slice(0, 200);
  if (!reason) return NextResponse.json({ error: 'Phải ghi lý do' }, { status: 400 });
  if (b.action !== 'sua' && b.action !== 'huy') return NextResponse.json({ error: 'Thao tác không đúng' }, { status: 400 });
  const { data: p } = await supabaseAdmin.from('co_paint_slips').select(COT).eq('so_phieu', String(b.so_phieu || '')).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Không có phiếu' }, { status: 404 });
  const ph = p as KsPhieu;
  if (!duocSua(ph, session)) {
    return NextResponse.json({ error: `Chỉ tổ trưởng Coating sửa / xoá được, trong ${KS_SUA_NGAY} ngày. Quá hạn: báo admin app Coating điều chỉnh` }, { status: 403 });
  }
  if (Number(b.version) !== ph.version) return NextResponse.json({ error: 'Phiếu vừa được sửa ở máy khác — tải lại rồi làm lại' }, { status: 409 });

  let lines = ph.lines;
  if (b.action === 'sua') {
    const [ton, phieu] = await Promise.all([docTon(), docPhieu()]);
    if (!ton?.ok) return NextResponse.json({ error: 'Chưa có số tồn từ app chính — thử lại sau ít phút' }, { status: 409 });
    // mã dòng cũ giữ nguyên theo (vật tư, lô); dòng mới đánh số tiếp — app Coating thay đúng dòng, không trừ 2 lần
    const cu = new Map(ph.lines.map((d) => [`${d.product_id}|${d.lot_id}`, d.line_id]));
    let stt = Math.max(0, ...ph.lines.map((d) => Number(d.line_id.split('-').pop()) || 0));
    lines = sachDong(b.lines).map((d) => ({ ...d, line_id: cu.get(`${d.product_id}|${d.lot_id}`) ?? `${ph.so_phieu}-${++stt}` }));
    if (new Set(lines.map((d) => d.line_id)).size !== lines.length) return NextResponse.json({ error: 'Một lô chỉ 1 dòng' }, { status: 400 });
    const loi = kiemDongKs(lines, ton, tonTam(ton, phieu, ph.so_phieu));
    if (loi) return NextResponse.json({ error: loi }, { status: 400 });
  }
  const h: KsLichSu = { v: ph.version + 1, by: session.fullName || session.username, at: new Date().toISOString(),
    action: b.action, reason, before: ph.lines };
  const { data: kq, error } = await supabaseAdmin.from('co_paint_slips').update({
    version: ph.version + 1, lines, history: [...(ph.history || []), h], synced_at: null, last_error: null,
    status: b.action === 'huy' ? 'cancelled' : 'pending', cancel_reason: b.action === 'huy' ? reason : null,
    updated_at: new Date().toISOString(),
  }).eq('so_phieu', ph.so_phieu).eq('version', ph.version).select('so_phieu');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!kq?.length) return NextResponse.json({ error: 'Phiếu vừa được sửa ở máy khác — tải lại rồi làm lại' }, { status: 409 });
  return NextResponse.json({ ok: true, version: ph.version + 1 });
}
