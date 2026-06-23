import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import PrintControls from '@/components/PrintControls';
import { toTitleCase } from '@/lib/format';

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
  if (!session) redirect('/login');

  const { id } = await params;
  const sp = await searchParams;
  const autoprint = sp.autoprint === '1';

  const { data: reg } = await supabaseAdmin
    .from('overtime_registrations')
    .select('id, department, overtime_date, day_type, time_from, time_to, duration_hours, registered_by')
    .eq('id', id)
    .maybeSingle();

  if (!reg) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Không tìm thấy phiếu.</p>
      </main>
    );
  }

  // Non-admin chỉ xem phiếu bộ phận mình
  if (session.role !== 'admin' && session.department !== reg.department) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Không có quyền xem phiếu này.</p>
      </main>
    );
  }

  const { data: items } = await supabaseAdmin
    .from('overtime_items')
    .select(
      'employee_id, equipment_id, item_code, planned_quantity, time_from, time_to, duration_hours',
    )
    .eq('registration_id', id);

  const empIds = Array.from(new Set((items ?? []).map((i) => i.employee_id)));
  const eqIds = Array.from(new Set((items ?? []).map((i) => i.equipment_id)));

  const [{ data: emps }, { data: eqs }, { data: requestor }] = await Promise.all([
    supabaseAdmin.from('employees').select('id, full_name, order_no').in('id', empIds),
    supabaseAdmin.from('equipments').select('id, code, machine_type').in('id', eqIds),
    reg.registered_by
      ? supabaseAdmin
          .from('users')
          .select('full_name')
          .eq('id', reg.registered_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const empMap = new Map((emps ?? []).map((e) => [e.id, e]));
  const eqMap = new Map((eqs ?? []).map((e) => [e.id, e]));
  const requestorName = requestor?.full_name ?? '—';

  // HD: HD-15..HD-31 = M4, HD-50..HD-55 = M3
  // RL: RL-09..RL-23 = M4 (RL-24 đặc thù, không gộp), RL-40..RL-42 = M3
  function machineGroup(code: string): 'M4' | 'M3' | null {
    const hdMatch = code.match(/^HD-(\d+)$/i);
    if (hdMatch) {
      const n = parseInt(hdMatch[1], 10);
      if (n >= 15 && n <= 31) return 'M4';
      if (n >= 50 && n <= 55) return 'M3';
    }
    const rlMatch = code.match(/^RL-(\d+)$/i);
    if (rlMatch) {
      const n = parseInt(rlMatch[1], 10);
      if (n >= 9 && n <= 23) return 'M4';
      if (n >= 40 && n <= 42) return 'M3';
    }
    return null;
  }

  type GroupRow = { code: string; item_code: string; qty: number; isOther?: boolean };
  const groups = new Map<
    string,
    {
      order_no: number;
      full_name: string;
      time_from: string;
      time_to: string;
      duration_hours: number;
      individual: GroupRow[];
      m4: GroupRow[];
      m3: GroupRow[];
    }
  >();
  for (const it of items ?? []) {
    const emp = empMap.get(it.employee_id);
    const eq = eqMap.get(it.equipment_id);
    if (!emp || !eq) continue;
    if (!groups.has(emp.id)) {
      // Giờ hiển thị lấy từ item (nếu admin đã sửa per-row), fallback header
      groups.set(emp.id, {
        order_no: emp.order_no,
        full_name: emp.full_name,
        time_from: it.time_from ?? reg.time_from,
        time_to: it.time_to ?? reg.time_to,
        duration_hours: Number(it.duration_hours ?? reg.duration_hours),
        individual: [],
        m4: [],
        m3: [],
      });
    }
    const isOther = eq.machine_type === 'OTHER';
    const row: GroupRow = {
      code: eq.code,
      item_code: it.item_code,
      qty: it.planned_quantity ?? 0,
      isOther,
    };
    const slot = groups.get(emp.id)!;
    if (isOther) {
      slot.individual.push(row);
      continue;
    }
    const grp = machineGroup(eq.code);
    if (grp === 'M4') slot.m4.push(row);
    else if (grp === 'M3') slot.m3.push(row);
    else slot.individual.push(row);
  }

  // Gộp M4/M3 thành 1 dòng "{DEPT}-M{x} (NEA)" với mã hàng "M{x}", số lượng = tổng.
  // Sort NV:
  //   - NV chỉ có "Công việc khác" (toàn bộ items đều OTHER) -> xếp cuối phiếu.
  //   - Còn lại theo order_no trong bảng employees.
  // Trong cùng NV: dòng CVK luôn nằm sau máy thường.
  const groupPrefix = reg.department;
  const hasNonOther = (g: { individual: GroupRow[]; m4: GroupRow[]; m3: GroupRow[] }) =>
    g.individual.some((r) => !r.isOther) || g.m4.length > 0 || g.m3.length > 0;
  const sortedGroups = [...groups.values()]
    .sort((a, b) => {
      const aHas = hasNonOther(a);
      const bHas = hasNonOther(b);
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.order_no - b.order_no;
    })
    .map((g) => {
      const individualSorted = [...g.individual].sort((a, b) => {
        if (a.isOther === b.isOther) return 0;
        return a.isOther ? 1 : -1;
      });
      const rows: GroupRow[] = [...individualSorted];
      if (g.m4.length > 0) {
        rows.push({
          code: `${groupPrefix}-M4 (${g.m4.length}EA)`,
          item_code: 'M4',
          qty: g.m4.reduce((s, r) => s + r.qty, 0),
        });
      }
      if (g.m3.length > 0) {
        rows.push({
          code: `${groupPrefix}-M3 (${g.m3.length}EA)`,
          item_code: 'M3',
          qty: g.m3.reduce((s, r) => s + r.qty, 0),
        });
      }
      // Đảm bảo CVK xếp sau M3/M4 (CVK isOther → cuối list rows)
      rows.sort((a, b) => {
        if (Boolean(a.isOther) === Boolean(b.isOther)) return 0;
        return a.isOther ? 1 : -1;
      });
      return {
        full_name: g.full_name,
        time_from: g.time_from,
        time_to: g.time_to,
        duration_hours: g.duration_hours,
        rows,
      };
    });

  // Giờ hiển thị per nhân viên — đã tính sẵn khi build groups phía trên.
  // Header time (reg.time_from/to) giờ chỉ dùng fallback cho dòng chưa có time riêng.
  const { d: dd, m: mm, y: yyyy } = formatDateVN(reg.overtime_date);

  // Chiều cao dòng tự cân để fit 1 trang A4 dọc — RÀNG BUỘC CỨNG.
  // A4 portrait: 297mm. Margin 8mm × 2 = 16mm. Vùng in 281mm.
  // Fixed: top 18mm + title 9mm + requestor 12mm + thead 14mm
  //   + sig (22mm pad + 9mm header/margin) + footer 7mm = ~91mm
  // Còn lại cho tbody: 281 - 91 = 190mm. Conservative: 178mm (chừa 12mm buffer).
  // Sig pad 22mm > row max 13mm → row ký tên lớn hơn 70% so với row mã hàng.
  const totalRows = sortedGroups.reduce((s, g) => s + g.rows.length, 0);
  const availMm = 178;
  const rowHeightMm = totalRows > 0
    ? Math.min(13, Math.max(5, availMm / totalRows))
    : 10;

  // Format số kiểu US: 13,500 thay vì 13.500
  const fmtQty = (n: number) => n.toLocaleString('en-US');

  return (
    <main className="min-h-screen bg-brand-surface p-4 print:min-h-0 print:p-0 print:bg-white">
      <div className="max-w-5xl mx-auto print:max-w-none">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <div>
            <p className="text-sm text-brand-navy-soft">
              Phiếu ngày {reg.overtime_date} • Bộ phận {reg.department}
            </p>
          </div>
          <PrintControls id={id} autoprint={autoprint} />
        </div>

        <article className="ot-form bg-white p-6 md:p-10 shadow-sm print:shadow-none print:p-0 text-[13px] text-black">
          <div className="flex justify-between items-start mb-2">
            <div>
              <Image
                src="/logo.png"
                alt="Hansungbolt Vina"
                width={890}
                height={405}
                priority
                unoptimized
                className="h-16 w-auto"
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

          <header className="text-center mb-2">
            <h1 className="font-bold text-xl leading-tight">
              PHIẾU ĐĂNG KÝ TĂNG CA
            </h1>
            <div className="text-sm font-semibold mt-0.5">OVERTIME REGISTRATION FORM</div>
          </header>

          <div className="grid grid-cols-2 ot-bordered mb-0">
            <div className="p-2 ot-border-r">
              <div>
                Người yêu cầu: <strong>{requestorName}</strong>
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

          <table
            className="w-full border-collapse text-center"
            style={{ tableLayout: 'fixed' }}
          >
            <colgroup>
              <col style={{ width: '3%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                <th className="ot-cell px-1 py-1 w-10" rowSpan={2}>
                  STT
                  <div className="text-[10px] italic font-normal">No.</div>
                </th>
                <th className="ot-cell px-2 py-1" rowSpan={2}>
                  Họ và tên
                  <div className="text-[10px] italic font-normal">Full Name</div>
                </th>
                <th className="ot-cell px-1 py-1" colSpan={2}>
                  Thời gian đăng ký tăng ca
                  <div className="text-[10px] italic font-normal">Registration time overtime</div>
                </th>
                <th className="ot-cell px-1 py-1" colSpan={2}>
                  Thời gian tăng ca thực tế
                  <div className="text-[10px] italic font-normal">Actual overtime</div>
                </th>
                <th className="ot-cell px-1 py-1" rowSpan={2}>
                  Thiết bị
                  <br />
                  sản xuất
                </th>
                <th className="ot-cell px-1 py-1" rowSpan={2}>
                  Mã hàng
                </th>
                <th className="ot-cell px-1 py-1" rowSpan={2}>
                  Số lượng
                  <br />
                  kế hoạch
                </th>
                <th className="ot-cell px-1 py-1" rowSpan={2}>
                  Số lượng
                  <br />
                  thực tế
                </th>
                <th className="ot-cell px-1 py-1 w-12" rowSpan={2}>
                  Tỉ lệ
                </th>
                <th className="ot-cell px-1 py-1" rowSpan={2}>
                  Ghi chú
                </th>
              </tr>
              <tr>
                <th className="ot-cell px-1 py-1 font-semibold">
                  Từ – Đến
                  <div className="text-[10px] italic font-normal">From…to</div>
                </th>
                <th className="ot-cell px-1 py-1 font-semibold">
                  Số giờ
                  <div className="text-[10px] italic font-normal">Total hour</div>
                </th>
                <th className="ot-cell px-1 py-1 font-semibold">
                  Giờ kết thúc
                  <div className="text-[10px] italic font-normal">Finish time</div>
                </th>
                <th className="ot-cell px-1 py-1 font-semibold">
                  Số giờ
                  <div className="text-[10px] italic font-normal">Total hour</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.length === 0 && (
                <tr>
                  <td className="ot-cell p-4 text-gray-400 italic" colSpan={12}>
                    Phiếu không có dòng nào
                  </td>
                </tr>
              )}
              {sortedGroups.map((group, gIdx) => {
                const span = group.rows.length;
                const stt = gIdx + 1;
                return group.rows.map((row, rIdx) => (
                  <tr key={`${gIdx}-${rIdx}`} className="ot-row">
                    {rIdx === 0 && (
                      <>
                        <td className="ot-cell px-1 py-1" rowSpan={span}>
                          {stt}
                        </td>
                        <td className="ot-cell px-2 py-1 text-left whitespace-nowrap" rowSpan={span}>
                          {toTitleCase(group.full_name)}
                        </td>
                        <td className="ot-cell px-1 py-1 whitespace-nowrap" rowSpan={span}>
                          {formatTime(group.time_from)}-{formatTime(group.time_to)}
                        </td>
                        <td className="ot-cell px-1 py-1" rowSpan={span}>
                          {group.duration_hours}
                        </td>
                        <td className="ot-cell px-1 py-1" rowSpan={span}></td>
                        <td className="ot-cell px-1 py-1" rowSpan={span}></td>
                      </>
                    )}
                    {row.isOther ? (
                      <>
                        <td className="ot-cell px-1 py-1 ot-code">Công việc khác</td>
                        <td className="ot-cell px-1 py-1 ot-code italic">{row.item_code}</td>
                        <td className="ot-cell px-1 py-1"></td>
                        <td className="ot-cell px-1 py-1"></td>
                        <td className="ot-cell px-1 py-1"></td>
                        <td className="ot-cell px-1 py-1"></td>
                      </>
                    ) : (
                      <>
                        <td className="ot-cell px-1 py-1 ot-code">{row.code}</td>
                        <td className="ot-cell px-1 py-1 ot-code">{row.item_code}</td>
                        <td className="ot-cell px-1 py-1 text-center whitespace-nowrap">
                          {fmtQty(row.qty)}
                        </td>
                        <td className="ot-cell px-1 py-1"></td>
                        <td className="ot-cell px-1 py-1"></td>
                        <td className="ot-cell px-1 py-1"></td>
                      </>
                    )}
                  </tr>
                ));
              })}
            </tbody>
          </table>

          <div
            className="ot-signatures grid ot-bordered mt-3 text-center"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            <div className="ot-border-r">
              <div className="font-bold py-1 ot-border-b">Người ghi</div>
              <div className="ot-sig-pad h-32"></div>
            </div>
            <div className="ot-border-r">
              <div className="font-bold py-1 ot-border-b">Kiểm Tra</div>
              <div className="ot-sig-pad h-32"></div>
            </div>
            <div className="ot-border-r">
              <div className="font-bold py-1 ot-border-b">Giám sát</div>
              <div className="ot-sig-pad h-32"></div>
            </div>
            <div>
              <div className="font-bold py-1 ot-border-b">Nhân sự</div>
              <div className="ot-sig-pad h-32"></div>
            </div>
          </div>

          <p className="ot-footer italic text-xs mt-2 leading-relaxed">{FOOTER_NOTE}</p>
        </article>
      </div>

      <style>{`
        /* Border đồng bộ 1px solid đen — dùng chung cho mọi nơi */
        .ot-cell { border: 1px solid #000; }
        .ot-bordered { border: 1px solid #000; }
        .ot-border-r { border-right: 1px solid #000; }
        .ot-border-b { border-bottom: 1px solid #000; }

        /* Font Arial cho toàn phiếu (đồng bộ với phiếu tổng hợp) */
        .ot-form, .ot-form * {
          font-family: Arial, Helvetica, sans-serif !important;
        }

        /* Mã máy / mã hàng: cho phép wrap khi quá dài, không nowrap */
        .ot-code {
          white-space: normal;
          word-break: break-all;
          overflow-wrap: anywhere;
          line-height: 1.15;
        }

        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          main { min-height: 0 !important; padding: 0 !important; background: white !important; }
          .ot-form {
            font-size: 8.5pt !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .ot-form h1 { font-size: 13pt !important; line-height: 1.1 !important; }
          .ot-form header { margin-bottom: 2px !important; }
          .ot-form header > div { font-size: 9pt !important; line-height: 1.1 !important; }
          .ot-form table { font-size: 8pt !important; }
          .ot-form table th {
            padding: 1px 1px !important;
            line-height: 1.05 !important;
          }
          .ot-form table td {
            padding: 1px 2px !important;
            line-height: 1.1 !important;
            height: ${rowHeightMm}mm !important;
          }
          .ot-form table th .text-\\[10px\\] { font-size: 6pt !important; }
          /* Sig pad 22mm > row mã hàng max 13mm → chỗ ký tên cao hơn 70% */
          .ot-form .ot-sig-pad { height: 22mm !important; }
          .ot-form .ot-signatures { margin-top: 3px !important; }
          .ot-form .ot-signatures .font-bold { padding: 2px 0 !important; font-size: 9pt !important; }
          .ot-form .ot-footer { font-size: 7pt !important; margin-top: 2px !important; line-height: 1.2 !important; }
          .ot-form img { height: 34px !important; }
          /* Đảm bảo border in chính xác */
          .ot-form * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </main>
  );
}
