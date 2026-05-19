// Số đọc tiếng Việt 0-10 dùng chung các game.
export const VI_NUM = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
  'mười',
];

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Câu khen luân phiên — không lặp lại số/đồ vật bé vừa chọn, đỡ rườm.
const PRAISES = [
  'Giỏi quá!',
  'Đúng rồi!',
  'Hay lắm!',
  'Tuyệt vời!',
  'Bé giỏi ghê!',
];
let _praiseIdx = 0;
export function nextPraise(): string {
  const p = PRAISES[_praiseIdx % PRAISES.length];
  _praiseIdx++;
  return p;
}
