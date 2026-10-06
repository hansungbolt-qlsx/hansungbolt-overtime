import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import { canUseCoDay, isISODate, parseStage } from '@/lib/co-day';

// Bảng KẾT QUẢ COATING NGÀY (anh Hữu 05/10/2026) — agent render trang này ra PDF khi có lệnh in 'co_day'.
// A4 ngang, 7 cột anh chốt: Máy · Chỉ thị thư · Mã hàng · LOT NO · Trọng lượng · Nhân viên · Ghi chú.
// stage=84 (06/10/2026): bảng Kết quả A/B công đoạn 84
export default async function PrintCoDayPage({ searchParams }: { searchParams: Promise<{ date?: string; stage?: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canUseCoDay(session)) redirect('/register');
  const sp = await searchParams;
  const date = sp.date ?? '';
  if (!isISODate(date)) redirect('/register');
  const stage = parseStage(sp.stage);

  const { data: slip } = await supabaseAdmin
    .from('co_day_slips').select('id, status, sent_by_name, sent_at').eq('work_date', date).eq('stage', stage).maybeSingle();
  const { data: lines } = slip
    ? await supabaseAdmin
        .from('co_day_lines')
        .select('seq_no, machine, lot_no, lot_label, saeji, item_code, weight_kg, lot_weight_kg, employee_name, note, matched')
        .eq('slip_id', slip.id)
        .order('machine').order('seq_no')
    : { data: [] as never[] };
  const rows = lines ?? [];
  const total = rows.reduce((s, r) => s + Number(r.weight_kg || 0), 0);
  const [y, m, d] = date.split('-');
  const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const saejiDisp = (s: string | null) => (s && s.length >= 6 ? `${s.slice(-6, -3)}-${s.slice(-3)}` : s ?? '');

  const th: React.CSSProperties = { border: '1px solid #000', padding: '6px 4px', background: '#D9E1F2', fontSize: 12 };
  const td: React.CSSProperties = { border: '1px solid #000', padding: '5px 4px', fontSize: 12, textAlign: 'center' };
  return (
    <main style={{ fontFamily: 'Arial, sans-serif', color: '#000', padding: '8mm' }}>
      <style>{`@page { size: A4 landscape; margin: 8mm; } body { margin: 0; }`}</style>
      <h1 style={{ textAlign: 'center', fontSize: 20, margin: '0 0 4px' }}>
        {stage === '84' ? 'KẾT QUẢ A/B (CÔNG ĐOẠN 84)' : 'KẾT QUẢ COATING'} NGÀY {d}/{m}/{y} · {stage === '84' ? 'A/B 일일 실적' : '코팅 일일 실적'}
      </h1>
      <div style={{ fontSize: 11, marginBottom: 6 }}>
        Bộ phận: Coating · Công đoạn: {stage === '84' ? 'A/B (84)' : 'Coating (86)'} · Người gửi: {slip?.sent_by_name ?? '—'} · Số dòng: {rows.length} · Tổng: {fmt(total)} Kg
        {slip?.status !== 'received' ? ' · (bản đang ghi, chưa gửi app chính)' : ''}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '5%' }}>STT</th>
            <th style={{ ...th, width: '8%' }}>Máy<br />설비</th>
            <th style={{ ...th, width: '11%' }}>Chỉ thị thư<br />지시서</th>
            <th style={{ ...th, width: '17%' }}>Mã hàng<br />품목</th>
            <th style={{ ...th, width: '15%' }}>LOT NO<br />로트</th>
            <th style={{ ...th, width: '11%' }}>Trọng lượng (Kg)<br />중량</th>
            <th style={{ ...th, width: '15%' }}>Nhân viên<br />작업자</th>
            <th style={{ ...th, width: '18%' }}>Ghi chú<br />비고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={td}>{i + 1}</td>
              <td style={td}>{r.machine}</td>
              <td style={td}>{saejiDisp(r.saeji)}</td>
              <td style={{ ...td, textAlign: 'left' }}>{r.item_code}</td>
              <td style={td}>{r.lot_label || r.lot_no}{r.matched ? '' : ' *'}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmt(Number(r.weight_kg))}</td>
              <td style={td}>{r.employee_name}</td>
              <td style={{ ...td, textAlign: 'left' }}>{r.note}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, fontWeight: 700, background: '#D9E1F2' }} colSpan={5}>TỔNG 합계</td>
            <td style={{ ...td, fontWeight: 700, background: '#D9E1F2', textAlign: 'right' }}>{fmt(total)}</td>
            <td style={{ ...td, background: '#D9E1F2' }} colSpan={2}></td>
          </tr>
        </tbody>
      </table>
      {rows.some((r) => !r.matched) && (
        <div style={{ fontSize: 10, marginTop: 4 }}>* LOT gõ tay, không có trong danh sách LOT xi mạ ERP.</div>
      )}
    </main>
  );
}
