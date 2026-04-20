'use client';

import { useEffect } from 'react';

type Photo = { id: string; url: string | null; employee_name: string | null };

export default function PrintClient({
  date,
  photos,
}: {
  date: string;
  photos: Photo[];
}) {
  useEffect(() => {
    window.print();
  }, []);

  const sheets: Photo[][] = [];
  for (let i = 0; i < photos.length; i += 8) {
    sheets.push(photos.slice(i, i + 8));
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4 portrait; margin: 0; }
        body { background: white; font-family: sans-serif; }
        .sheet {
          width: 210mm;
          height: 297mm;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(4, 1fr);
          page-break-after: always;
          break-after: page;
        }
        .cell {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: 1px solid #000;
        }
        .cell img { width: 100%; height: 100%; object-fit: fill; display: block; }
        .name-tag {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(255,255,255,0.88);
          color: #000;
          font-size: 13pt;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          line-height: 1.2;
          letter-spacing: 0.03em;
        }
        .no-print {
          padding: 12px 16px;
          background: #f0f4ff;
          border-bottom: 1px solid #c7d2fe;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .no-print span { font-size: 13px; color: #374151; }
        .no-print button {
          padding: 6px 14px;
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
          padding: 6px 12px;
          background: #e5e7eb;
          color: #374151;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          line-height: 1;
        }
        .btn-close:hover { background: #d1d5db; }
        @media print { .no-print { display: none; } }
      `}</style>

      <div className="no-print">
        <span>
          Tem NVL ngày {date} — {photos.length} ảnh — {sheets.length} tờ
        </span>
        <button onClick={() => window.print()}>In ngay</button>
        <button className="btn-close" onClick={() => window.close()} title="Đóng">✕</button>
      </div>

      {sheets.map((sheet, si) => (
        <div key={si} className="sheet">
          {Array.from({ length: 8 }, (_, i) => {
            const photo = sheet[i];
            return (
              <div key={i} className="cell">
                {photo?.url ? (
                  <img src={photo.url} alt={`Tem ${si * 8 + i + 1}`} />
                ) : null}
                {photo?.employee_name ? (
                  <span className="name-tag">{photo.employee_name}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
