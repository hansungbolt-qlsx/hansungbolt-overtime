/**
 * Convert "TRẦN ANH TUẤN" → "Trần Anh Tuấn"
 * Hỗ trợ ký tự tiếng Việt có dấu.
 */
export function toTitleCase(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLocaleLowerCase('vi-VN')
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toLocaleUpperCase('vi-VN') + word.slice(1) : ''))
    .join(' ')
    .trim();
}
