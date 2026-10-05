// Danh sách MÃ HÀNG COATING + RPM chuẩn (anh Hữu gửi 05/10/2026, 15 mã — đã đối chiếu master ERP Good, đủ 15/15).
// Dùng cho form đăng ký tăng ca bộ phận CO: gõ mã → gợi ý, chọn mã → RPM tự điền (vẫn sửa tay được).
// Thêm/sửa mã: sửa mảng dưới rồi deploy.
export type CoItem = { code: string; name: string; rpm: number; coating: string; adhesive_g_ea: number };

export const CO_ITEMS: CoItem[] = [
  { code: '080620-UM1A-2A', name: 'HEX BOLT P/W B=13 8*62', rpm: 110, coating: '593SB', adhesive_g_ea: 0.1093 },
  { code: '120300-UM1A-4AC', name: 'HEX(UP)S,P/W (Ø 38) M12X30', rpm: 70, coating: '1193SBO', adhesive_g_ea: 0.10768 },
  { code: '080300-FM5L-DS', name: 'FL M/S SE(STS430) 8*30', rpm: 150, coating: '593SB', adhesive_g_ea: 0.08 },
  { code: '100350-F51A-D', name: 'F/L BOLT 10*35', rpm: 100, coating: '593SB', adhesive_g_ea: 0.1333 },
  { code: '080660-U51A-2D', name: 'BOLT DAMPER P/W 8*66', rpm: 110, coating: '593SB', adhesive_g_ea: 0.0773 },
  { code: '080315-JM6R-DH', name: 'SPIDER BOLT 8x31.5', rpm: 150, coating: '1193SBO', adhesive_g_ea: 0.108 },
  { code: '050160-TM5R', name: 'TH M/S(STS430) 5*16', rpm: 230, coating: '1193SBO', adhesive_g_ea: 0.0371 },
  { code: '050160-FM5R-AP', name: 'FL BOLT (STS430) 5*16', rpm: 230, coating: '1193SBO', adhesive_g_ea: 0.0404 },
  { code: '080140-ZM6L-D', name: 'BOLT OF MOTOR M8*14', rpm: 55, coating: '593SB', adhesive_g_ea: 0.0805 },
  { code: '080290-FM6R-D', name: 'SPIDER BOLT 8x29', rpm: 150, coating: '1193SBO', adhesive_g_ea: 0.108 },
  { code: '050120-Y52A-DPZ', name: 'ADJUST SCREW 5*12', rpm: 150, coating: 'Nylon Powder', adhesive_g_ea: 0.0086 },
  { code: '260050-P51A', name: 'PH M/S M2.6*5', rpm: 175, coating: '593SB', adhesive_g_ea: 0.0071 },
  { code: '050180-K54A-AZ', name: 'TH/W(ISO)M/S COATING M5*18', rpm: 60, coating: '593SB', adhesive_g_ea: 0.0324 },
  { code: '260080-P52A-3PN', name: 'PH M/S S/W M2.6x8', rpm: 100, coating: '593SB', adhesive_g_ea: 0.04 },
  { code: '120362-UM1A-4A', name: 'HEX(UP) S, P/W CO M12x36.2', rpm: 70, coating: '1193SBO', adhesive_g_ea: 0.1077 },
];

const BY_CODE = new Map(CO_ITEMS.map((i) => [i.code.toUpperCase(), i]));

/** Tra mã (không phân biệt hoa thường, bỏ khoảng trắng). */
export function findCoItem(code: string): CoItem | undefined {
  return BY_CODE.get((code ?? '').trim().toUpperCase());
}

export const CO_ITEMS_DATALIST_ID = 'co-item-codes';
