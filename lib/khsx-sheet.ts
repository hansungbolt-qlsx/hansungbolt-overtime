import * as XLSX from 'xlsx';

// Trích 1 sheet KHSX (file ISO app chính đẩy sang) thành dữ liệu render:
// rows = từ HÀNG TIÊU ĐỀ CỘT trở xuống (bỏ khối logo/tiêu đề phía trên),
// giá trị đã format sẵn ("26,700", "(144,310)"), merges quy về gốc rows.
export type KhsxSheet = {
  rows: (string | null)[][];
  merges: { r: number; c: number; rs: number; cs: number }[];
  nCols: number;
  machineCol: number;
  itemCol: number;
  cttCol: number;
  statusCol: number;
};

function norm(v: unknown): string {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function extractKhsxSheet(ws: XLSX.WorkSheet | undefined): KhsxSheet | null {
  if (!ws) return null;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: false,
  });

  let h = -1;
  for (let i = 0; i < Math.min(matrix.length, 12); i++) {
    const row = (matrix[i] ?? []).map(norm);
    if (row[0] === 'NO' && row.includes('ITEM CODE')) {
      h = i;
      break;
    }
  }
  if (h < 0) return null;

  const header = (matrix[h] ?? []).map(norm);
  const nCols = header.length;
  const rows = matrix.slice(h).map((r) => {
    const out: (string | null)[] = [];
    for (let c = 0; c < nCols; c++) {
      const v = (r ?? [])[c];
      out.push(v == null || String(v).trim() === '' ? null : String(v));
    }
    return out;
  });

  const merges = (ws['!merges'] ?? [])
    .filter((m) => m.s.r >= h && m.s.c < nCols)
    .map((m) => ({
      r: m.s.r - h,
      c: m.s.c,
      rs: m.e.r - m.s.r + 1,
      cs: Math.min(m.e.c, nCols - 1) - m.s.c + 1,
    }));

  return {
    rows,
    merges,
    nCols,
    machineCol: header.findIndex((v) => v === 'MÁY' || v === 'MÁY HD'),
    itemCol: header.indexOf('ITEM CODE'),
    cttCol: header.findIndex((v) => v === 'SỐ CHỈ THỊ'),
    statusCol: header.findIndex((v) => v === 'TÌNH TRẠNG'),
  };
}
