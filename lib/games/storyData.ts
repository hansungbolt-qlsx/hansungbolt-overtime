import type { SceneSpec } from '@/components/games/story/Scenery';

export type StoryPage = { text: string; scene: SceneSpec };
export type Story = {
  id: string;
  title: string;
  emoji: string;
  moral: string;
  pages: StoryPage[];
};

// Giọng kể: rút gọn giữ cốt + logic; giữ tình huống gây cấn; giữ thoại
// tình cảm/giáo dục & thoại hung dữ của nhân vật phản diện để ba mẹ
// nhập vai; văn phong chân thực cho bé 4 tuổi, pha chút hài vui.
// Bản này chờ ba mẹ duyệt voice trước khi nhân ra các truyện còn lại.
export const STORIES: Story[] = [
  {
    id: 'bo-dua',
    title: 'Câu chuyện bó đũa',
    emoji: '🥢',
    moral: 'Anh em đoàn kết thì không ai thắng được.',
    pages: [
      {
        text: 'Ngày xưa, có một ông cụ sống cùng các con trai. Nhưng mấy anh em suốt ngày cãi nhau. Người này hét: "Tại anh!", người kia cãi: "Tại em!". Ông cụ nghe mà buồn lắm.',
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
        text: 'Một hôm, ông gọi các con lại, đưa ra một bó đũa thật to và nói nhẹ nhàng: "Con nào bẻ gãy được cả bó đũa này, cha sẽ thưởng quà thật lớn."',
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
        text: 'Các con hí hửng thay nhau bẻ. Họ gồng mình: "Hự!... Hự!...", mặt đỏ tía tai. Vậy mà bó đũa vẫn trơ trơ, chẳng gãy chiếc nào. Ai cũng lắc đầu chịu thua.',
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
        text: 'Ông cụ mỉm cười, cởi bó đũa ra, đưa từng chiếc một. Tách! Tách! Lần này chiếc nào cũng gãy ngon ơ, dễ như bẻ que kẹo.',
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
        text: 'Ông ôm các con vào lòng, dịu dàng dạy: "Các con thấy chưa? Tách lẻ thì yếu, nhưng anh em thương yêu, đoàn kết thì mạnh như cả bó đũa, không ai thắng nổi." Từ đó, mấy anh em không còn cãi nhau nữa.',
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
        text: 'Tích Chu ở với bà. Bà thương Tích Chu lắm, miếng gì ngon cũng để dành cho cậu, còn mình chỉ ăn cơm với rau.',
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
        text: 'Nhưng Tích Chu chỉ mải rong chơi. Một hôm bà ốm, nằm trên giường, khẽ gọi: "Tích Chu ơi… bà khát nước quá, lấy cho bà ngụm nước con nhé…". Gọi mãi mà chẳng thấy Tích Chu đâu.',
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
        text: 'Không có ai cho uống nước, bà hoá thành một con chim, vỗ cánh bay đi. Tích Chu chơi chán chạy về, thấy chim liền hốt hoảng: "Bà ơi! Bà đừng bỏ con!".',
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
        text: 'Chim buồn bã đáp: "Cúc cu… Bà đi tìm nước đây. Tích Chu ở lại ngoan nhé.". Rồi chim bay xa dần. Tích Chu oà khóc nức nở, ân hận vô cùng.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 35, y: 96, s: 1.2 },
            { k: 'tree', x: 170, y: 96, s: 1.2 },
            { k: 'bird', x: 150, y: 44, s: 1.3, tap: 'bounce' },
            { k: 'boy', x: 95, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Bỗng một bà Tiên hiện ra, dịu dàng bảo: "Nếu cháu muốn bà trở lại, hãy đi thật xa, lấy nước ở suối Tiên mang về cho bà uống.". Tích Chu lau nước mắt, đi ngay.',
        scene: {
          bg: 'river',
          items: [
            { k: 'woman', x: 70, y: 92, s: 1.5, tap: 'bounce' },
            { k: 'boy', x: 120, y: 92, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Vượt núi vượt rừng, cuối cùng Tích Chu cũng lấy được nước. Bà uống xong liền trở lại thành người. Từ đó, Tích Chu luôn ở bên, yêu thương và chăm sóc bà.',
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
