// Gộp danh sách mã máy theo quy tắc trên phiếu in:
//   - HD-15..HD-31 → M4 (NEA)
//   - HD-50..HD-55 → M3 (NEA)
//   - RL-09..RL-23 → M4 (NEA)   (RL-24 đặc thù không gộp)
//   - RL-40..RL-42 → M3 (NEA)
//   - Còn lại: hiển thị individual, gộp cùng prefix ("HD-12, 13, 14")
//
// Ví dụ input [HD-12, HD-13, HD-16, HD-17, HD-50, HD-51]
//   → "HD-12, 13, M4(2EA), M3(2EA)"

export type MachineInput = {
  code: string;
  isOther?: boolean; // Công việc khác
  otherText?: string; // nội dung nhập khi isOther
};

function machineGroup(code: string): 'M4' | 'M3' | null {
  const hd = code.match(/^HD-(\d+)$/i);
  if (hd) {
    const n = parseInt(hd[1], 10);
    if (n >= 15 && n <= 31) return 'M4';
    if (n >= 50 && n <= 55) return 'M3';
  }
  const rl = code.match(/^RL-(\d+)$/i);
  if (rl) {
    const n = parseInt(rl[1], 10);
    if (n >= 9 && n <= 23) return 'M4';
    if (n >= 40 && n <= 42) return 'M3';
  }
  return null;
}

export function formatMachines(items: MachineInput[]): string {
  const individual: string[] = [];
  let m4 = 0;
  let m3 = 0;
  const otherTasks: string[] = [];

  for (const it of items) {
    if (it.isOther) {
      otherTasks.push(it.otherText || 'Công việc khác');
      continue;
    }
    const grp = machineGroup(it.code);
    if (grp === 'M4') m4++;
    else if (grp === 'M3') m3++;
    else individual.push(it.code);
  }

  // Gộp individual theo prefix ("HD-", "RL-", "SM-", "CT-"…) → "HD-12, 13, 14"
  const byPrefix: Record<string, string[]> = {};
  const prefixOrder: string[] = [];
  for (const code of individual) {
    const m = code.match(/^([A-Z]+)-(.+)$/i);
    if (!m) {
      if (!byPrefix['']) {
        byPrefix[''] = [];
        prefixOrder.push('');
      }
      byPrefix[''].push(code);
      continue;
    }
    const [, prefix, suffix] = m;
    if (!byPrefix[prefix]) {
      byPrefix[prefix] = [];
      prefixOrder.push(prefix);
    }
    byPrefix[prefix].push(suffix);
  }

  const parts: string[] = [];
  for (const p of prefixOrder) {
    const suffixes = byPrefix[p];
    parts.push(p ? `${p}-${suffixes.join(', ')}` : suffixes.join(', '));
  }
  if (m4 > 0) parts.push(`M4(${m4}EA)`);
  if (m3 > 0) parts.push(`M3(${m3}EA)`);
  for (const t of otherTasks) parts.push(`Công việc khác: ${t}`);

  return parts.join(', ');
}

// Tổng số "đơn vị máy" cho 1 NV — dùng để show "N máy". Công việc khác tính 1.
export function countMachines(items: MachineInput[]): number {
  return items.length;
}
