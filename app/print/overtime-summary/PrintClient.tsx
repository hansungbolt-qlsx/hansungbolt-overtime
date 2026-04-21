'use client';

import { useEffect } from 'react';
import { toTitleCase } from '@/lib/format';

type DateEntry = { date: string; dayType: 'weekday' | 'sunday' };
type EmpRow = { id: string; name: string; byDate: Record<string, number> };

export default function PrintClient({
  month,
  overtimeDates,
  employees,
}: {
  month: string;
  overtimeDates: DateEntry[];
  employees: EmpRow[];
}) {
  useEffect(() => {
    window.print();
  }, []);

  const [y, m] = month.split('-');
  const title = `TỔNG HỢP GIỜ TĂNG CA THÁNG ${parseInt(m)}/${y}`;

  const grandTotal = employees.reduce((s, e) => {
    return s + Object.values(e.byDate).reduce((a, b) => a + b, 0);
  }, 0);

  const dateColTotals = overtimeDates.map((d) =>
    employees.reduce((s, e) => s + (e.byDate[d.date] ?? 0), 0),
  );

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4 landscape; margin: 1cm; }
        body { background: white; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; }
        .page, .page * { font-family: Arial, Helvetica, sans-serif !important; }

        .no-print {
          padding: 10px 14px;
          background: #f0f4ff;
          border-bottom: 1px solid #c7d2fe;
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: sans-serif;
        }
        .no-print span { font-size: 13px; color: #374151; }
        .no-print button {
          padding: 5px 14px;
          background: #1e3a5f;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-close {
          margin-left: auto;
          padding: 5px 12px;
          background: #e5e7eb;
          color: #374151;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-close:hover { background: #d1d5db; }
        @media print { .no-print { display: none; } }

        .page { padding: 0; }
        .report-title {
          text-align: center;
          font-size: 13pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 12px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9pt;
        }
        th, td {
          border: 1px solid #333;
          padding: 3px 4px;
          text-align: center;
          vertical-align: middle;
          white-space: nowrap;
        }
        th { background: #d0dff5; font-weight: 700; }
        td.name { text-align: left; padding-left: 6px; font-weight: 600; }
        td.stt { width: 24px; }
        td.worked { background: #e8f4e8; font-weight: 700; }
        td.sunday-worked { background: #fff0d0; font-weight: 700; }
        th.sunday-col { background: #f5e0c0; }
        td.total-col { background: #dce8fa; font-weight: 700; font-size: 10pt; }
        th.total-col { background: #bbd0f0; }
        tfoot td { background: #dce8fa; font-weight: 700; }
        tfoot td.stt { background: #dce8fa; }
        tfoot td.name { background: #dce8fa; text-align: right; font-style: italic; }

        .legend {
          margin-top: 8px;
          font-size: 8pt;
          color: #444;
          display: flex;
          gap: 16px;
        }
        .legend-item { display: flex; align-items: center; gap: 4px; }
        .swatch { display: inline-block; width: 12px; height: 12px; border: 1px solid #999; }
      `}</style>

      <div className="no-print">
        <span>{title}</span>
        <button onClick={() => window.print()}>In ngay</button>
        <button className="btn-close" onClick={() => window.close()}>✕</button>
      </div>

      <div className="page">
        <div className="report-title">{title}</div>

        <table>
          <thead>
            <tr>
              <th className="stt">STT</th>
              <th style={{ textAlign: 'left', paddingLeft: 6 }}>Họ và tên</th>
              {overtimeDates.map((d) => {
                const day = d.date.slice(8);
                return (
                  <th key={d.date} className={d.dayType === 'sunday' ? 'sunday-col' : ''}>
                    {day}
                    {d.dayType === 'sunday' ? <><br /><span style={{ fontWeight: 400, fontSize: '7pt' }}>CN</span></> : null}
                  </th>
                );
              })}
              <th className="total-col">Ngày<br />thường</th>
              <th className="total-col">Chủ<br />nhật</th>
              <th className="total-col">Tổng<br />giờ</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, idx) => {
              // Tổng giờ ngày thường = sum giờ thực tế mọi ngày weekday NV đã tăng ca
              const weekdayHours = overtimeDates
                .filter((d) => d.dayType === 'weekday')
                .reduce((s, d) => s + (emp.byDate[d.date] ?? 0), 0);
              const sundayHours = overtimeDates
                .filter((d) => d.dayType === 'sunday')
                .reduce((s, d) => s + (emp.byDate[d.date] ?? 0), 0);
              const total = weekdayHours + sundayHours;
              return (
                <tr key={emp.id}>
                  <td className="stt">{idx + 1}</td>
                  <td className="name">{toTitleCase(emp.name)}</td>
                  {overtimeDates.map((d) => {
                    const h = emp.byDate[d.date];
                    return (
                      <td
                        key={d.date}
                        className={h ? (d.dayType === 'sunday' ? 'sunday-worked' : 'worked') : ''}
                      >
                        {h ? `${h}h` : ''}
                      </td>
                    );
                  })}
                  <td className="total-col">{weekdayHours > 0 ? `${weekdayHours}h` : ''}</td>
                  <td className="total-col">{sundayHours > 0 ? `${sundayHours}h` : ''}</td>
                  <td className="total-col">{total > 0 ? `${total}h` : ''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="stt"></td>
              <td className="name">Tổng cộng</td>
              {dateColTotals.map((t, i) => (
                <td key={i}>{t > 0 ? `${t}h` : ''}</td>
              ))}
              <td></td>
              <td></td>
              <td className="total-col">{grandTotal}h</td>
            </tr>
          </tfoot>
        </table>

        <div className="legend">
          <div className="legend-item">
            <span className="swatch" style={{ background: '#e8f4e8' }}></span>
            Ngày thường
          </div>
          <div className="legend-item">
            <span className="swatch" style={{ background: '#fff0d0' }}></span>
            Chủ nhật
          </div>
        </div>
      </div>
    </>
  );
}
