const VI_MAP: Record<string, string> = {
  'À':'A','Á':'A','Ả':'A','Ã':'A','Ạ':'A','Ă':'A','Ắ':'A','Ặ':'A','Ằ':'A','Ẳ':'A','Ẵ':'A',
  'Â':'A','Ấ':'A','Ậ':'A','Ầ':'A','Ẩ':'A','Ẫ':'A',
  'È':'E','É':'E','Ẻ':'E','Ẽ':'E','Ẹ':'E','Ê':'E','Ế':'E','Ệ':'E','Ề':'E','Ể':'E','Ễ':'E',
  'Ì':'I','Í':'I','Ỉ':'I','Ĩ':'I','Ị':'I',
  'Ò':'O','Ó':'O','Ỏ':'O','Õ':'O','Ọ':'O','Ô':'O','Ố':'O','Ộ':'O','Ồ':'O','Ổ':'O','Ỗ':'O',
  'Ơ':'O','Ớ':'O','Ợ':'O','Ờ':'O','Ở':'O','Ỡ':'O',
  'Ù':'U','Ú':'U','Ủ':'U','Ũ':'U','Ụ':'U','Ư':'U','Ứ':'U','Ự':'U','Ừ':'U','Ử':'U','Ữ':'U',
  'Ý':'Y','Ỷ':'Y','Ỹ':'Y','Ỵ':'Y','Ỳ':'Y','Đ':'D',
};

/** Chuyển tên tiếng Việt sang ASCII an toàn cho storage key (TUẤN → TUAN) */
export function toStorageKey(name: string): string {
  return name
    .split('').map(c => VI_MAP[c] ?? c).join('')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, '-')
    .toUpperCase()
    .trim();
}

/** Tra ngược từ storage key về tên hiển thị đầy đủ (TUAN → TUẤN) */
export function resolveDisplayName(key: string): string {
  const match = HD_EMPLOYEES.find(e => toStorageKey(e.display) === key);
  return match?.display ?? key;
}

export const HD_EMPLOYEES: { full: string; display: string }[] = [
  { full: 'TRẦN ANH TUẤN',    display: 'TUẤN'     },
  { full: 'NGUYỄN TIẾN DŨNG', display: 'DŨNG'     },
  { full: 'NGUYỄN XUÂN QUANG',display: 'QUANG'    },
  { full: 'PHẠM TUẤN VŨ',     display: 'VŨ'       },
  { full: 'PHẠM TẤN PHONG',   display: 'PHONG'    },
  { full: 'HÀ QUỐC ĐIỆP',     display: 'ĐIỆP'     },
  { full: 'PHẠM HỮU ANH',     display: 'HỮU ANH'  },
  { full: 'VŨ CÔNG THAO',     display: 'THAO'     },
  { full: 'NGUYỄN ĐỨC GIÁP', display: 'GIÁP'     },
  { full: 'NGUYỄN CẢNH THIẾT',display: 'THIẾT'    },
  { full: 'NGUYỄN QUỐC BẢO', display: 'BẢO'      },
  { full: 'TRẦN XUÂN ĐẠT',   display: 'ĐẠT'      },
  { full: 'HỨA TẤN ANH',     display: 'TẤN ANH'  },
  { full: 'ĐINH MẠNH HOÀNG', display: 'HOÀNG'    },
];
