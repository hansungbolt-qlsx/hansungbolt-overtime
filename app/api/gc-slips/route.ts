import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';
import { canUseGiaCong, kiemDong, gcUid, GC_CD_NHAP, GC_CONG_DOAN, type GcLine, type GcLoai } from '@/lib/gia-cong';

export const runtime = 'nodejs';

// ============================================================
// Phiếu ĐẶT / NHẬP gia công 70/80 trên điện thoại — CHỈ qlsx (anh Hữu chốt 14/10/2026).
// Supabase chỉ là hộp thư; agent nhận phiếu Gửi qua Realtime → app chính (huu duyệt, Đẩy ERP) → trạng thái ghi về.
//
//   GET    /api/gc-slips?loai=dat|nhap   → phiếu 30 ngày gần nhất + thùng đang GIỮ CHỖ (cùng lượt, không tốn thêm)
//   POST   /api/gc-slips                 → {uid?, loai, cong_doan, ncc, lines, note, send}
//            lưu đè 1 dòng (chỉ khi phiếu đang 'draft' / 'rejected'); send=true = Gửi (pending, synced_at NULL → agent)
//   DELETE /api/gc-slips?uid=…           → xoá phiếu NHÁP chưa gửi
// ============================================================

// GIỮ CHỖ (bài học phiếu kho NVL 21/08): thùng chờ về đã nằm trong phiếu nhập CHƯA KHÉP (nháp / đã gửi / đã duyệt
// chưa lên ERP) thì không được tích lại ở phiếu khác — tránh nhập 2 lần 1 thùng. Đã lên ERP thì gương tự trừ.
const MO = ['draft', 'pending', 'approved'];

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !canUseGiaCong(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const loai = (new URL(req.url).searchParams.get('loai') || 'dat') as GcLoai;
  const tu = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('gc_slips')
    .select('id,uid,loai,cong_doan,ncc,status,lines,note,created_by_name,sent_at,synced_at,last_error,reject_reason,approved_by,approved_at,erp_ref,created_at,updated_at')
    .gte('created_at', tu)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  const giuCho: Record<string, string> = {};      // 'dat_no-dat_seq' → uid phiếu đang giữ
  for (const s of rows) {
    if (s.loai !== 'nhap' || !MO.includes(s.status)) continue;
    for (const l of (s.lines as GcLine[]) || []) if (l.dat_no) giuCho[`${l.dat_no}-${l.dat_seq}`] = s.uid;
  }
  return NextResponse.json({ slips: rows.filter((s) => s.loai === loai), giu_cho: giuCho, partial: rows.length >= 200 });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !canUseGiaCong(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  let b: { uid?: string; loai?: GcLoai; cong_doan?: string; ncc?: string; lines?: GcLine[]; note?: string; send?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 }); }
  const loai = b.loai;
  if (loai !== 'dat' && loai !== 'nhap') return NextResponse.json({ error: 'Loại phiếu không đúng' }, { status: 400 });
  const cdHopLe = loai === 'nhap' ? (GC_CD_NHAP as string[]) : Object.keys(GC_CONG_DOAN);
  if (!b.cong_doan || !cdHopLe.includes(b.cong_doan))
    return NextResponse.json({ error: `Công đoạn ${loai === 'nhap' ? 'phiếu nhập chỉ 70 / 80' : 'không đúng'}` }, { status: 400 });
  if (!b.ncc) return NextResponse.json({ error: 'Chưa chọn nhà gia công' }, { status: 400 });
  const lines: GcLine[] = (b.lines || []).map((l) => ({
    saeji_no: String(l.saeji_no || '').trim(), ma_hang: String(l.ma_hang || '').trim(), ten_hang: l.ten_hang || '',
    kg: Number(l.kg),
    ...(loai === 'nhap' ? { dat_no: l.dat_no, dat_seq: l.dat_seq, kg_dat: l.kg_dat, kg_da_ve: l.kg_da_ve,
      hoan_thanh: (l.hoan_thanh === 0 ? 0 : 1) as 0 | 1 } : {}),
  }));
  const loi = kiemDong(loai, lines);
  if (loi) return NextResponse.json({ error: loi }, { status: 400 });

  const uid = b.uid || gcUid(loai);
  const { data: cu } = await supabaseAdmin.from('gc_slips').select('status').eq('uid', uid).maybeSingle();
  if (cu && !['draft', 'rejected'].includes(cu.status)) {
    return NextResponse.json({ error: 'Phiếu đã gửi / đã duyệt — không sửa được nữa' }, { status: 409 });
  }
  if (loai === 'nhap') {                          // giữ chỗ: thùng đã nằm ở phiếu khác chưa khép
    const { data: khac } = await supabaseAdmin.from('gc_slips').select('uid,lines')
      .eq('loai', 'nhap').in('status', MO).neq('uid', uid).limit(200);
    const dang = new Set<string>();
    for (const s of khac ?? []) for (const l of (s.lines as GcLine[]) || []) if (l.dat_no) dang.add(`${l.dat_no}-${l.dat_seq}`);
    const trung = lines.find((l) => dang.has(`${l.dat_no}-${l.dat_seq}`));
    if (trung) return NextResponse.json({ error: `Thùng ${trung.dat_no}-${trung.dat_seq} đang nằm ở phiếu khác chưa khép` }, { status: 409 });
  }
  const now = new Date().toISOString();
  const row = {
    uid, loai, cong_doan: b.cong_doan, ncc: b.ncc, lines, note: (b.note || '').slice(0, 500) || null,
    status: b.send ? 'pending' : 'draft', synced_at: null, last_error: null,
    ...(b.send ? { sent_at: now, reject_reason: null } : {}),
    created_by_name: session.fullName || session.username, updated_at: now,
  };
  const { error } = await supabaseAdmin.from('gc_slips').upsert(row, { onConflict: 'uid' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, uid, status: row.status });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || !canUseGiaCong(session)) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const uid = new URL(req.url).searchParams.get('uid') || '';
  const { data: cu } = await supabaseAdmin.from('gc_slips').select('status').eq('uid', uid).maybeSingle();
  if (!cu) return NextResponse.json({ error: 'Không có phiếu' }, { status: 404 });
  if (cu.status !== 'draft') return NextResponse.json({ error: 'Chỉ xoá được phiếu đang lập (chưa gửi)' }, { status: 409 });
  const { error } = await supabaseAdmin.from('gc_slips').delete().eq('uid', uid).eq('status', 'draft');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
