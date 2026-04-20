import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import PrintControls from '@/components/PrintControls';

const FOOTER_NOTE =
  '* Lưu ý: Đề nghị viết phiếu tăng ca và nộp cho phòng Nhân sự trước 14h30 trước khi tăng ca. Trường hợp tăng ca trước và nộp đơn sau thì sẽ không được tính tiền tăng ca của ngày đó.';

function formatTime(t: string) {
  return t.slice(0, 5).replace(':', 'h');
}

function formatDateVN(iso: string) {
  const [y, m, d] = iso.split('-');
  return { d, m, y };
}

export default async function PrintViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login');

  const { id } = await params;
  const sp = await searchParams;
  const autoprint = sp.autoprint === '1';

  const { data: reg } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department, overtime_date, day_type, time_from, time_to, duration_hours')
    .eq('id', id)
    .maybeSingle();

  if (!reg) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Không tìm thấy phiếu.</p>
      </main>
    );
  }

  const { data: items } = await supabaseAdmin
    .from('overtime_items')
    .select('employee_id, equipment_id, item_code, planned_quantity')
    .eq('registration_id', id);

  const empIds = Array.from(new Set((items ?? []).map((i) => i.employee_id)));
  const eqIds = Array.from(new Set((items ?? []).map((i) => i.equipment_id)));

  const [{ data: emps }, { data: eqs }] = await Promise.all([
    supabaseAdmin.from('employees').select('id, full_name, order_no').in('id', empIds),
    supabaseAdmin.from('equipments').select('id, code').in('id', eqIds),
  ]);

  const empMap = new Map((emps ?? []).map((e) => [e.id, e]));
  const eqMap = new Map((eqs ?? []).map((e) => [e.id, e]));

  type GroupRow = { code: string; item_code: string; qty: number };
  const groups = new Map<
    string,
    { order_no: number; full_name: string; rows: GroupRow[] }
  >();
  for (const it of items ?? []) {
    const emp = empMap.get(it.employee_id);
    const eq = eqMap.get(it.equipment_id);
    if (!emp || !eq) continue;
    if (!groups.has(emp.id)) {
      groups.set(emp.id, { order_no: emp.order_no, full_name: emp.full_name, rows: [] });
    }
    groups.get(emp.id)!.rows.push({
      code: eq.code,
      item_code: it.item_code,
      qty: it.planned_quantity,
    });
  }
  const sortedGroups = [...groups.values()].sort((a, b) => a.order_no - b.order_no);

  const timeLabel = `${formatTime(reg.time_from)}-${formatTime(reg.time_to)}`;
  const hours = Number(reg.duration_hours);
  const { d: dd, m: mm, y: yyyy } = formatDateVN(reg.overtime_date);

  return (
    <main className="min-h-screen bg-brand-surface p-4 print:p-0 print:bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="print:hidden">
            <p className="text-sm text-brand-navy-soft">
              Phiếu ngày {reg.overtime_date} • Bộ phận {reg.department}
            </p>
          </div>
          <PrintControls id={id} autoprint={autoprint} />
        </div>

        <article className="bg-white p-6 md:p-10 shadow-sm print:shadow-none print:p-0 text-[13px] text-black">
          <div className="flex justify-between items-start mb-2">
            <div>
              <Image
                src="/logo.png"
                alt="Hansungbolt Vina"
                width={890}
                height={405}
                priority
                unoptimized
                className="h-12 w-auto"
              />
              <div className="mt-2 text-sm">
                Số:
                <span className="inline-block border-b border-black w-24 ml-1 align-bottom">&nbsp;</span>
              </div>
            </div>
            <div className="text-sm font-semibold whitespace-nowrap pt-1">
              Ngày <span className="inline-block border-b border-dotted border-black px-2">{dd}</span>{' '}
              tháng <span className="inline-block border-b border-dotted border-black px-2">{mm}</span>{' '}
              Năm <span className="inline-block border-b border-dotted border-black px-2">{yyyy}</span>
            </div>
          </div>

          <header className="text-center mb-3">
            <h1 className="font-bold text-2xl leading-tight">
              PHIẾU ĐĂNG KÝ TĂNG CA
            </h1>
            <div className="text-base font-semibold mt-0.5">OVERTIME REGISTRATION FORM</div>
          </header>

          <div className="grid grid-cols-2 border border-black mb-0">
            <div className="p-2 border-r border-black">
              <div>
                Người yêu cầu: <strong>HOÀNG CHÍNH HỮU</strong>
              </div>
              <div className="text-xs italic text-gray-600">Requestor</div>
            </div>
            <div className="p-2">
              <div>
                Bộ phận: <strong>{reg.department}</strong>
              </div>
              <div className="text-xs italic text-gray-600">Department</div>
            </div>
          </div>

          <table className="w-full border-collapse border border-black text-center">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-black px-1 py-1 w-10" rowSpan={2}>
                  STT
                  <div className="text-[10px] italic font-normal">No.</div>
                </th>
                <th className="border border-black px-2 py-1" rowSpan={2}>
                  Họ và tên
                  <div className="text-[10px] italic font-normal">Full Name</div>
                </th>
                <th className="border border-black px-1 py-1" colSpan={2}>
                  Thời gian đăng ký tăng ca
                  <div className="text-[10px] italic font-normal">Registration time overtime</div>
                </th>
                <th className="border border-black px-1 py-1" colSpan={2}>
                  Thời gian tăng ca thực tế
                  <div className="text-[10px] italic font-normal">Actual overtime</div>
                </th>
                <th className="border border-black px-1 py-1" rowSpan={2}>
                  Thiết bị
                  <br />
                  sản xuất
                </th>
                <th className="border border-black px-1 py-1" rowSpan={2}>
                  Mã hàng
                </th>
                <th className="border border-black px-1 py-1" rowSpan={2}>
                  Số lượng
                  <br />
                  kế hoạch
                </th>
                <th className="border border-black px-1 py-1" rowSpan={2}>
                  Số lượng
                  <br />
                  thực tế
                </th>
                <th className="border border-black px-1 py-1 w-12" rowSpan={2}>
                  Tỉ lệ
                </th>
                <th className="border border-black px-1 py-1" rowSpan={2}>
                  Ghi chú
                </th>
              </tr>
              <tr>
                <th className="border border-black px-1 py-1 font-normal text-xs">
                  Từ – Đến
                  <div className="text-[10px] italic">From…to</div>
                </th>
                <th className="border border-black px-1 py-1 font-normal text-xs">
                  Số giờ
                  <div className="text-[10px] italic">Total hour</div>
                </th>
                <th className="border border-black px-1 py-1 font-normal text-xs">
                  Giờ kết thúc
                  <div className="text-[10px] italic">Finish time</div>
                </th>
                <th className="border border-black px-1 py-1 font-normal text-xs">
                  Số giờ
                  <div className="text-[10px] italic">Total hour</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.length === 0 && (
                <tr>
                  <td className="border border-black p-4 text-gray-400 italic" colSpan={12}>
                    Phiếu không có dòng nào
                  </td>
                </tr>
              )}
              {sortedGroups.map((group, gIdx) => {
                const span = group.rows.length;
                const stt = gIdx + 1;
                return group.rows.map((row, rIdx) => (
                  <tr key={`${gIdx}-${rIdx}`}>
                    {rIdx === 0 && (
                      <>
                        <td className="border border-black px-1 py-1" rowSpan={span}>
                          {stt}
                        </td>
                        <td className="border border-black px-2 py-1 text-left" rowSpan={span}>
                          {group.full_name}
                        </td>
                        <td className="border border-black px-1 py-1" rowSpan={span}>
                          {timeLabel}
                        </td>
                        <td className="border border-black px-1 py-1" rowSpan={span}>
                          {hours}
                        </td>
                        <td className="border border-black px-1 py-1" rowSpan={span}></td>
                        <td className="border border-black px-1 py-1" rowSpan={span}></td>
                      </>
                    )}
                    <td className="border border-black px-1 py-1">{row.code}</td>
                    <td className="border border-black px-1 py-1">{row.item_code}</td>
                    <td className="border border-black px-1 py-1 text-right">
                      {row.qty.toLocaleString('vi-VN')}
                    </td>
                    <td className="border border-black px-1 py-1"></td>
                    <td className="border border-black px-1 py-1"></td>
                    {rIdx === 0 && (
                      <td className="border border-black px-1 py-1" rowSpan={span}></td>
                    )}
                  </tr>
                ));
              })}
            </tbody>
          </table>

          <div
            className="grid border border-black mt-4 text-center"
            style={{ gridTemplateColumns: '1fr 1fr 1fr 1.5fr' }}
          >
            <div className="border-r border-black">
              <div className="font-bold py-1.5 border-b border-black bg-gray-50">Người ghi</div>
              <div className="h-20"></div>
            </div>
            <div className="border-r border-black">
              <div className="font-bold py-1.5 border-b border-black bg-gray-50">Kiểm Tra</div>
              <div className="h-20"></div>
            </div>
            <div className="border-r border-black">
              <div className="font-bold py-1.5 border-b border-black bg-gray-50">Giám sát</div>
              <div className="h-20"></div>
            </div>
            <div>
              <div className="font-bold py-1.5 border-b border-black bg-gray-50">Nhân sự</div>
              <div className="h-20"></div>
            </div>
          </div>

          <p className="italic text-xs mt-3 leading-relaxed">{FOOTER_NOTE}</p>
        </article>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white !important; }
        }
      `}</style>
    </main>
  );
}
