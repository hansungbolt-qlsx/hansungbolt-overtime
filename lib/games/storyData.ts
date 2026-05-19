import type { SceneSpec } from '@/components/games/story/Scenery';

export type StoryPage = { text: string; scene: SceneSpec };
export type Story = {
  id: string;
  title: string;
  emoji: string;
  moral: string;
  pages: StoryPage[];
};

// Bản rút gọn cho bé 4-5 tuổi — bố mẹ đọc. Nội dung chờ ba mẹ duyệt.
export const STORIES: Story[] = [
  {
    id: 'bo-dua',
    title: 'Câu chuyện bó đũa',
    emoji: '🥢',
    moral: 'Anh em đoàn kết thì không ai thắng được.',
    pages: [
      {
        text: 'Ngày xưa, có một người cha già sống cùng các con trai. Nhưng các con hay cãi nhau, không ai chịu nhường ai.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 100, y: 96, s: 0.7 },
            { k: 'oldMan', x: 60, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 155, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một hôm, người cha gọi các con lại. Ông đưa ra một bó đũa và bảo: "Ai bẻ gãy được bó đũa này, cha sẽ thưởng."',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 55, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'bundle', x: 100, y: 100, s: 2, tap: 'wobble' },
            { k: 'man', x: 150, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Các con trai thay nhau cố sức bẻ cả bó đũa. Nhưng dù mạnh đến đâu, không ai bẻ gãy được.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'man', x: 70, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'bundle', x: 105, y: 100, s: 2, tap: 'wobble' },
            { k: 'man', x: 145, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Người cha mỉm cười, cởi bó đũa ra, đưa từng chiếc một. Lần này, các con bẻ gãy thật dễ dàng.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 60, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 155, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Người cha dạy: "Các con thấy không? Chia lẻ thì yếu, đoàn kết thì mạnh. Anh em thương nhau sẽ không ai thắng được."',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'cloud', x: 150, y: 26 },
            { k: 'oldMan', x: 70, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 110, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 145, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'tich-chu',
    title: 'Cậu bé Tích Chu',
    emoji: '🐦',
    moral: 'Hãy yêu thương và quan tâm người thân khi còn bên nhau.',
    pages: [
      {
        text: 'Tích Chu sống với bà. Bà rất thương Tích Chu, có gì ngon cũng để dành cho cậu.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 80, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'boy', x: 115, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Nhưng Tích Chu mải chơi suốt ngày. Một hôm bà bị ốm, khát nước, gọi mãi mà Tích Chu không nghe.',
        scene: {
          bg: 'day',
          items: [
            { k: 'cloud', x: 40, y: 26 },
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 55, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'boy', x: 160, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Vì không ai cho uống nước, bà hoá thành một con chim bay đi tìm nước. Tích Chu chạy về thì bà đã bay xa.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 40, y: 96, s: 1.3 },
            { k: 'bird', x: 130, y: 50, s: 1.6, tap: 'bounce' },
            { k: 'boy', x: 80, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Tích Chu khóc nức nở và đi tìm bà khắp nơi. Cậu ân hận vì đã không quan tâm đến bà.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 35, y: 96, s: 1.2 },
            { k: 'tree', x: 170, y: 96, s: 1.2 },
            { k: 'boy', x: 100, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Một bà Tiên hiện ra và bảo: "Muốn bà trở lại, con hãy đi lấy nước suối Tiên cho bà uống."',
        scene: {
          bg: 'river',
          items: [
            { k: 'woman', x: 70, y: 92, s: 1.5, tap: 'bounce' },
            { k: 'boy', x: 120, y: 92, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Tích Chu vượt đường xa lấy được nước. Bà uống vào liền trở lại thành người. Từ đó, cậu luôn yêu thương, chăm sóc bà.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 80, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'boy', x: 115, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
];

export const getStory = (id: string) => STORIES.find((s) => s.id === id);
