import * as XLSX from 'xlsx';

export type ParsedRow = {
  machineShort: string;
  itemCode: string;
};

/**
 * Chuyển ký hiệu rút gọn ở cột máy thành danh sách mã thiết bị HD đầy đủ.
 *   "1"      → ["HD-01"]
 *   "7A"     → ["HD-7A"]
 *   "9,10"   → ["HD-09", "HD-10"]
 *   "15~31"  → ["HD-15", "HD-16", ..., "HD-31"]
 */
export function expandMachineCode(raw: string): string[] {
  const tokens = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const token of tokens) {
    if (token.includes('~')) {
      const [startStr, endStr] = token.split('~').map((s) => s.trim());
      const start = Number(startStr);
      const end = Number(endStr);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      for (let i = start; i <= end; i++) {
        result.push(`HD-${String(i).padStart(2, '0')}`);
      }
      continue;
    }

    const match = token.match(/^(\d+)([A-Z])?$/i);
    if (!match) continue;
    const [, numStr, suffix] = match;
    const num = Number(numStr);
    if (suffix) {
      result.push(`HD-${num}${suffix.toUpperCase()}`);
    } else {
      result.push(`HD-${String(num).padStart(2, '0')}`);
    }
  }
  return result;
}

const MACHINE_HEADERS = ['SỐ MÁY', 'M/C', 'THIẾT BỊ', 'MÁY'];
const ITEM_HEADERS = ['MÃ SẢN PHẨM', 'ITEM CODE', 'MÃ HÀNG', 'MÃ SP'];

function normalize(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function findColumn(row: unknown[], variants: string[]): number {
  for (let c = 0; c < row.length; c++) {
    if (variants.includes(normalize(row[c]))) return c;
  }
  return -1;
}

/**
 * Parse sheet kế hoạch ngày → list dòng (machine + itemCode).
 * Dò 20 hàng đầu tìm hàng tiêu đề có cả cột máy và mã sản phẩm,
 * đọc data xuống đến khi gặp "Total" hoặc hết sheet.
 */
export function parseSheet(sheet: XLSX.WorkSheet): ParsedRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  let headerIdx = -1;
  let machineCol = -1;
  let itemCol = -1;
  const scanLimit = Math.min(matrix.length, 20);
  for (let i = 0; i < scanLimit; i++) {
    const row = matrix[i] ?? [];
    const mCol = findColumn(row, MACHINE_HEADERS);
    const iCol = findColumn(row, ITEM_HEADERS);
    if (mCol >= 0 && iCol >= 0) {
      headerIdx = i;
      machineCol = mCol;
      itemCol = iCol;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error(
      'Không tìm thấy hàng tiêu đề có cả cột máy (SỐ MÁY / M/C / THIẾT BỊ) và MÃ SẢN PHẨM',
    );
  }

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (normalize(row[0]) === 'TOTAL') break;

    const mc = row[machineCol];
    const itemCode = row[itemCol];
    if (mc == null || String(mc).trim() === '') continue;
    if (itemCode == null || String(itemCode).trim() === '') continue;

    rows.push({
      machineShort: String(mc).trim(),
      itemCode: String(itemCode).trim(),
    });
  }
  return rows;
}
