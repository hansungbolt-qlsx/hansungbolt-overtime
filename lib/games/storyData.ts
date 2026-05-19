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
  {
    id: 'cay-tre-tram-dot',
    title: 'Cây tre trăm đốt',
    emoji: '🎍',
    moral: 'Thật thà, chăm chỉ thì hiền gặp lành; gian dối phải chừa.',
    pages: [
      {
        text: 'Anh Khoai nghèo nhưng khoẻ mạnh, thật thà, đi ở cho nhà phú ông. Phú ông ngọt nhạt: "Con cứ làm cho ta ba năm, ta sẽ gả con gái cho."',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 1 },
            { k: 'man', x: 70, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'oldMan', x: 110, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Khoai làm lụng quần quật ba năm. Nhưng phú ông nuốt lời, bảo: "Con lên rừng tìm được CÂY TRE TRĂM ĐỐT, ta mới gả con gái cho."',
        scene: {
          bg: 'forest',
          items: [
            { k: 'oldMan', x: 60, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'tree', x: 150, y: 96, s: 1.2 },
            { k: 'man', x: 105, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Khoai tìm khắp rừng, làm gì có cây tre nào trăm đốt! Anh ngồi bệt xuống, buồn rầu khóc một mình.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'bamboo', x: 50, y: 96 },
            { k: 'bamboo', x: 165, y: 96 },
            { k: 'man', x: 105, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Bụt hiện ra, hiền từ bảo: "Con chặt đủ trăm đốt tre, rồi hô: Khắc nhập! Khắc nhập!". Lạ chưa, trăm đốt tre tự ghép thành một cây thật dài!',
        scene: {
          bg: 'forest',
          items: [
            { k: 'oldMan', x: 60, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'bamboo', x: 130, y: 96, s: 1.2 },
            { k: 'man', x: 100, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Về tới nơi, phú ông đang gả con gái cho nhà giàu khác. Khoai hô to: "Khắc nhập!" — phú ông dính chặt vào cây tre, kêu oai oái xin tha.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 1 },
            { k: 'bamboo', x: 95, y: 96, s: 1.1 },
            { k: 'oldMan', x: 95, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'man', x: 55, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Phú ông hứa gả con gái thật. Khoai hô "Khắc xuất!" thả ông ra. Hai vợ chồng Khoai sống hạnh phúc. Kẻ gian dối cuối cùng phải chừa thói xấu.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'man', x: 85, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'woman', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'qua-dua-hau',
    title: 'Sự tích quả dưa hấu',
    emoji: '🍉',
    moral: 'Tự tay làm ra mới thật đáng quý.',
    pages: [
      {
        text: 'Mai An Tiêm chăm chỉ, tài giỏi, được vua quý. Nhưng chàng thẳng thắn: "Của mình tự làm ra mới thật quý." Vua nghe vậy nổi giận.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'man', x: 70, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'man', x: 110, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Vua đày Mai An Tiêm cùng vợ con ra đảo hoang, không cho mang theo gì cả.',
        scene: {
          bg: 'island',
          items: [
            { k: 'boat', x: 60, y: 100, s: 1.3 },
            { k: 'man', x: 120, y: 102, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Một hôm, chàng thấy đàn chim tha hạt lạ rồi đánh rơi. Chàng nhặt đem gieo, ngày ngày chăm bón.',
        scene: {
          bg: 'island',
          items: [
            { k: 'bird', x: 60, y: 50, s: 1.2, tap: 'bounce' },
            { k: 'man', x: 120, y: 102, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Hạt mọc thành cây, kết quả tròn to, vỏ xanh, ruột đỏ, ngọt lịm. Đó là quả dưa hấu!',
        scene: {
          bg: 'island',
          items: [
            { k: 'watermelon', x: 80, y: 100, s: 1.6, tap: 'bounce' },
            { k: 'man', x: 130, y: 102, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Chàng khắc tên mình lên quả, thả xuống biển. Dưa trôi đi muôn nơi, ai ăn cũng tấm tắc khen ngon.',
        scene: {
          bg: 'island',
          items: [
            { k: 'watermelon', x: 70, y: 100, s: 1.2 },
            { k: 'boat', x: 130, y: 100, s: 1.2 },
          ],
        },
      },
      {
        text: 'Vua biết tin, hối hận, sai thuyền đón gia đình về. Từ đó, ai cũng nhớ: của mình tự làm ra mới thật đáng quý.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'man', x: 80, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 115, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'tri-khon',
    title: 'Trí khôn của ta đây',
    emoji: '🐯',
    moral: 'Trí khôn quý hơn sức mạnh.',
    pages: [
      {
        text: 'Bác nông dân đang cày ruộng cùng con trâu hiền lành.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'hill', x: 160, y: 96 },
            { k: 'buffalo', x: 80, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Con hổ đi qua, thấy lạ liền hỏi trâu: "Mày to khoẻ thế, sao chịu làm tôi cho người bé tí?" Trâu đáp: "Vì người có TRÍ KHÔN."',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tiger', x: 60, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'buffalo', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Hổ tò mò chạy tới hỏi người: "Trí khôn của ngươi đâu? Cho ta xem thử!"',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tiger', x: 70, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Bác nông dân nghĩ kế, nói: "Trí khôn ta để ở nhà. Để ta về lấy. Nhưng sợ ngươi ăn mất trâu, ngươi chịu cho ta trói vào gốc cây nhé." Hổ gật đầu ngay.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 60, y: 96, s: 1.2 },
            { k: 'tiger', x: 80, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Trói thật chặt xong, bác cười lớn: "Trí khôn của ta đây!" rồi nổi lửa hù cho hổ một phen. Hổ vùng vẫy chạy thoát, lửa cháy thành những vằn đen trên mình.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 55, y: 96, s: 1.1 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'tiger', x: 140, y: 100, s: 1.4, tap: 'spin' },
          ],
        },
      },
      {
        text: 'Từ đó, loài hổ có những vằn đen trên lưng. Và ai cũng nhớ: trí khôn quý hơn sức mạnh.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 50, y: 96, s: 1.2 },
            { k: 'tiger', x: 120, y: 100, s: 1.5, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'hoa-cuc-trang',
    title: 'Sự tích hoa cúc trắng',
    emoji: '🌼',
    moral: 'Lòng hiếu thảo cảm động cả đất trời.',
    pages: [
      {
        text: 'Có hai mẹ con sống nghèo nhưng thương nhau. Một hôm, người mẹ bị bệnh nặng, nằm liệt giường.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 70, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'girl', x: 110, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Cô bé chạy đi tìm thầy thuốc. Dọc đường gặp một cụ già hiền hậu, cụ bảo: "Trong rừng có bông hoa trắng. Hoa bao nhiêu cánh, mẹ con sống thêm bấy nhiêu năm."',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 50, y: 96, s: 1.2 },
            { k: 'oldMan', x: 80, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'girl', x: 125, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Cô tìm mãi mới thấy bông hoa trắng. Nhưng đếm đi đếm lại chỉ có vài cánh. Cô lo lắm: "Vậy mẹ chỉ sống được mấy năm thôi sao?"',
        scene: {
          bg: 'forest',
          items: [
            { k: 'flower', x: 90, y: 96, s: 1.6, tap: 'wobble' },
            { k: 'girl', x: 130, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Cô bé liền nhẹ nhàng xé mỗi cánh hoa thành thật nhiều cánh nhỏ li ti, để mẹ được sống thật lâu, thật lâu bên cô.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'flower', x: 95, y: 96, s: 1.8, tap: 'spin' },
            { k: 'girl', x: 135, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Bông hoa nhiều cánh ấy chính là hoa cúc trắng. Mẹ cô khỏi bệnh, sống lâu bên con. Lòng hiếu thảo đã làm cảm động cả đất trời.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'flower', x: 60, y: 96, s: 1.3 },
            { k: 'oldWoman', x: 100, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'girl', x: 135, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'em-be-thong-minh',
    title: 'Em bé thông minh',
    emoji: '🧠',
    moral: 'Trí thông minh giúp ích cho mọi người.',
    pages: [
      {
        text: 'Vua sai quan đi tìm người tài. Quan gặp hai cha con đang cày, hỏi xoáy: "Trâu của ông một ngày cày được mấy đường?"',
        scene: {
          bg: 'day',
          items: [
            { k: 'buffalo', x: 55, y: 100, s: 1.2 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'boy', x: 130, y: 100, s: 1.2, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Em bé nhanh nhảu hỏi vặn lại: "Thế ngựa của ông một ngày đi được mấy bước ạ?" Quan ngẩn người, biết đã gặp người giỏi.',
        scene: {
          bg: 'day',
          items: [
            { k: 'boy', x: 80, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'man', x: 125, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Vua thử khó hơn: ban ba con trâu đực, bắt một năm phải đẻ thành chín con. Cả làng lo sốt vó.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'buffalo', x: 70, y: 100, s: 1.2 },
            { k: 'boy', x: 115, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Em bé vào sân rồng khóc ầm: "Cha con không chịu đẻ em bé cho con!" Vua bật cười: "Cha mày là đàn ông, đẻ sao được!". Em đáp ngay: "Vậy trâu đực sao đẻ được ạ?"',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.8 },
            { k: 'boy', x: 75, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'oldMan', x: 115, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Vua phục tài, ban thưởng thật hậu. Em bé thông minh dùng cái khôn của mình giúp cả làng vui vẻ.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'oldMan', x: 80, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'boy', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'cay-khe',
    title: 'Ăn khế trả vàng',
    emoji: '🥭',
    moral: 'Tham thì thâm; hiền lành thì gặp lành.',
    pages: [
      {
        text: 'Có hai anh em. Người anh tham lam chiếm hết của cải, chỉ chia cho em một cây khế và túp lều.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.8 },
            { k: 'tree', x: 60, y: 96, s: 1.2 },
            { k: 'man', x: 100, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Cây khế của người em sai trĩu quả ngọt. Bỗng một con chim lớn bay đến ăn khế.',
        scene: {
          bg: 'day',
          items: [
            { k: 'tree', x: 70, y: 96, s: 1.3 },
            { k: 'bird', x: 130, y: 48, s: 1.6, tap: 'bounce' },
            { k: 'man', x: 100, y: 100, s: 1.2, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Chim cất tiếng: "Ăn một quả, trả một cục vàng. May túi ba gang, mang đi mà đựng." Người em làm theo đúng lời.',
        scene: {
          bg: 'day',
          items: [
            { k: 'bird', x: 80, y: 60, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Chim chở người em ra hòn đảo đầy vàng. Anh chỉ lấy vừa đầy túi ba gang rồi về, sống no đủ, vẫn hiền lành.',
        scene: {
          bg: 'island',
          items: [
            { k: 'gold', x: 70, y: 100, s: 1.6 },
            { k: 'man', x: 120, y: 102, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Người anh tham, đòi đổi hết gia tài lấy cây khế. Chim cũng đến, hứa trả vàng y như vậy.',
        scene: {
          bg: 'day',
          items: [
            { k: 'tree', x: 70, y: 96, s: 1.2 },
            { k: 'bird', x: 130, y: 50, s: 1.6, tap: 'bounce' },
            { k: 'man', x: 100, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Nhưng anh tham may túi thật to, nhét vàng đầy ự. Chim chở nặng quá, anh trượt rơi tõm xuống biển, phải bơi mãi mới vào được bờ. Tham thì thâm!',
        scene: {
          bg: 'island',
          items: [
            { k: 'gold', x: 60, y: 100, s: 1.4 },
            { k: 'bird', x: 110, y: 46, s: 1.5, tap: 'spin' },
            { k: 'man', x: 140, y: 102, s: 1.3, tap: 'wobble' },
          ],
        },
      },
    ],
  },
  {
    id: 'banh-chung',
    title: 'Sự tích bánh chưng bánh dày',
    emoji: '🍙',
    moral: 'Lòng hiếu thảo và sự sáng tạo thật đáng quý.',
    pages: [
      {
        text: 'Vua Hùng đã già, muốn chọn người nối ngôi. Vua phán: "Ai dâng được món ngon ý nghĩa nhất, ta sẽ truyền ngôi cho."',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldMan', x: 80, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Các hoàng tử đua nhau lên rừng xuống biển tìm của ngon vật lạ.',
        scene: {
          bg: 'river',
          items: [
            { k: 'mountain', x: 50, y: 96, s: 1 },
            { k: 'boat', x: 130, y: 100, s: 1.2 },
            { k: 'man', x: 100, y: 100, s: 1.2, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Riêng hoàng tử Lang Liêu nghèo, chỉ có lúa gạo. Đêm nằm ngủ, chàng mơ thấy thần mách: "Hãy lấy gạo mà làm bánh."',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 40, y: 30 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'man', x: 100, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Lang Liêu gói bánh chưng vuông tượng hình Đất, giã bánh dày tròn tượng hình Trời, gói trọn lòng biết ơn cha mẹ, đất trời.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Vua nếm thử, gật gù khen bánh vừa ngon vừa ý nghĩa nhất, liền truyền ngôi cho Lang Liêu. Từ đó dân ta có bánh chưng, bánh dày ngày Tết.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'oldMan', x: 80, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'chu-cuoi',
    title: 'Sự tích chú Cuội cung trăng',
    emoji: '🌙',
    moral: 'Lời dặn dò cần phải nhớ kỹ và làm theo.',
    pages: [
      {
        text: 'Chú Cuội tình cờ tìm được một cây đa thần. Lá cây chữa được bách bệnh, Cuội cứu sống biết bao nhiêu người.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 90, y: 96, s: 1.6, tap: 'wobble' },
            { k: 'man', x: 140, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Cuội dặn vợ thật kỹ: "Cây quý lắm, nhớ tưới nước sạch thôi nhé. Tuyệt đối đừng tưới nước bẩn."',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'tree', x: 60, y: 96, s: 1.3 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 125, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Một hôm, vợ Cuội quên lời dặn, lỡ tưới nhầm nước bẩn. Cây đa bỗng rung chuyển, từ từ bật gốc bay lên trời!',
        scene: {
          bg: 'day',
          items: [
            { k: 'tree', x: 90, y: 70, s: 1.4, tap: 'wobble' },
            { k: 'woman', x: 130, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Cuội về tới, hốt hoảng nắm chặt rễ cây kéo lại. Nhưng cây cứ bay lên, mang theo cả chú Cuội lên tận cung trăng.',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 150, y: 32 },
            { k: 'tree', x: 90, y: 60, s: 1.3, tap: 'wobble' },
            { k: 'man', x: 95, y: 100, s: 1.2, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Từ đó, mỗi đêm rằm ngước nhìn ông trăng, ta thấy bóng chú Cuội ngồi bên gốc đa. Lời dặn dò, ai cũng cần nhớ kỹ.',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 100, y: 40, s: 1.6, tap: 'wobble' },
            { k: 'tree', x: 60, y: 96, s: 1 },
          ],
        },
      },
    ],
  },
  {
    id: 'thach-sanh',
    title: 'Thạch Sanh',
    emoji: '🗡️',
    moral: 'Người hiền lành, dũng cảm sẽ được đền đáp xứng đáng.',
    pages: [
      {
        text: 'Thạch Sanh mồ côi, sống dưới gốc đa, hiền lành và khoẻ mạnh. Lý Thông gian xảo giả vờ kết nghĩa anh em để lợi dụng chàng.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 60, y: 96, s: 1.4 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 135, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Vùng ấy có con chằn tinh rất dữ. Lý Thông lừa Thạch Sanh đi nộp mạng thay cho mình.',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 40, y: 30 },
            { k: 'snake', x: 130, y: 100, s: 1.6, tap: 'wobble' },
            { k: 'man', x: 80, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Chằn tinh gầm vang: "Kẻ nào to gan dám đến đây? Ta sẽ nuốt chửng ngươi!". Thạch Sanh không hề sợ, dũng cảm chiến đấu và diệt được con quái vật.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'mountain', x: 50, y: 96, s: 1 },
            { k: 'snake', x: 130, y: 100, s: 1.7, tap: 'spin' },
            { k: 'man', x: 90, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Lý Thông cướp công, được vua khen thưởng. Còn Thạch Sanh lại bị hắn hãm hại, nhốt sâu trong hang đá.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'mountain', x: 100, y: 96, s: 1.3 },
            { k: 'man', x: 120, y: 100, s: 1.2, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Trong hang, Thạch Sanh cứu được con vua Thuỷ Tề, được tặng một cây đàn thần kỳ diệu.',
        scene: {
          bg: 'river',
          items: [
            { k: 'gold', x: 70, y: 96, s: 1.3 },
            { k: 'man', x: 120, y: 92, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Tiếng đàn của Thạch Sanh ngân lên, giãi bày nỗi oan và vạch mặt Lý Thông. Vua hiểu rõ, gả công chúa cho chàng. Người tốt cuối cùng được hạnh phúc.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'man', x: 85, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'tam-cam',
    title: 'Tấm Cám',
    emoji: '👡',
    moral: 'Ở hiền gặp lành, cái ác sẽ bị trừng phạt.',
    pages: [
      {
        text: 'Tấm hiền lành, mồ côi mẹ, ở với dì ghẻ và Cám lười biếng. Dì ghẻ bắt Tấm làm việc quần quật suốt ngày.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'girl', x: 70, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'woman', x: 105, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'girl', x: 135, y: 100, s: 1.2, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Cám lừa trút hết giỏ tép của Tấm. Tấm ngồi khóc. Bụt hiện lên, cho Tấm con cá bống làm bạn để bầu bạn sớm hôm.',
        scene: {
          bg: 'river',
          items: [
            { k: 'oldMan', x: 70, y: 92, s: 1.4, tap: 'bounce' },
            { k: 'girl', x: 110, y: 92, s: 1.3, tap: 'wobble' },
            { k: 'fishJump', x: 150, y: 86, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Mẹ con Cám rình bắt cá bống ăn mất. Tấm lại khóc. Bụt dặn: "Con nhặt xương cá chôn xuống đất, sau này sẽ có điều kỳ diệu."',
        scene: {
          bg: 'river',
          items: [
            { k: 'woman', x: 70, y: 92, s: 1.3, tap: 'wobble' },
            { k: 'girl', x: 120, y: 92, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Đến ngày hội, Bụt giúp Tấm có quần áo đẹp, hài xinh đi xem hội. Vội về, Tấm đánh rơi một chiếc hài bên đường.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.8 },
            { k: 'girl', x: 100, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Nhà vua nhặt được chiếc hài, truyền lệnh ai đi vừa sẽ làm hoàng hậu. Chân Tấm đi vừa như in. Tấm được vua đón vào cung.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'man', x: 80, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'girl', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Mẹ con Cám ghen ghét tìm cách hại Tấm. Nhưng Tấm cứ hoá thân trở về. Cuối cùng cái ác bị trừng phạt, mẹ con Cám xấu hổ phải bỏ đi. Ở hiền thì gặp lành.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'girl', x: 85, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'son-tinh-thuy-tinh',
    title: 'Sơn Tinh Thủy Tinh',
    emoji: '🌊',
    moral: 'Kiên cường thì sẽ vượt qua mọi thử thách.',
    pages: [
      {
        text: 'Vua Hùng có nàng công chúa Mỵ Nương xinh đẹp, nết na. Vua muốn kén cho con một người chồng thật tài giỏi.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldMan', x: 80, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'girl', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Sơn Tinh — thần Núi, và Thủy Tinh — thần Nước, cùng đến cầu hôn. Ai cũng phép thuật cao cường, khó phân thắng bại.',
        scene: {
          bg: 'river',
          items: [
            { k: 'mountain', x: 50, y: 96, s: 1.1 },
            { k: 'man', x: 90, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 140, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Vua ra điều kiện: "Sáng mai, ai mang lễ vật tới trước, ta sẽ gả Mỵ Nương cho người đó."',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 80, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Sơn Tinh tới trước, rước Mỵ Nương về núi cao. Thủy Tinh tới sau, không lấy được vợ, tức giận đùng đùng.',
        scene: {
          bg: 'river',
          items: [
            { k: 'mountain', x: 60, y: 96, s: 1.3 },
            { k: 'man', x: 100, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'girl', x: 130, y: 100, s: 1.2, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Thủy Tinh hô mưa gọi gió, dâng nước cuồn cuộn đánh Sơn Tinh. Sơn Tinh bình tĩnh dời từng quả núi, nâng đồi cao lên chặn dòng nước.',
        scene: {
          bg: 'river',
          items: [
            { k: 'mountain', x: 70, y: 96, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 120, y: 96, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Nước dâng cao bao nhiêu, núi lại cao lên bấy nhiêu. Thủy Tinh đành chịu thua. Hằng năm vẫn dâng nước trả thù — đó là mùa lũ. Cứ kiên cường thì sẽ vượt qua.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'mountain', x: 100, y: 96, s: 1.4 },
          ],
        },
      },
    ],
  },
  {
    id: 'ho-guom',
    title: 'Sự tích Hồ Gươm',
    emoji: '🐢',
    moral: 'Được giúp đỡ thì phải biết ơn và trả lại.',
    pages: [
      {
        text: 'Giặc ngoại xâm tới quấy phá, dân ta khổ sở. Lê Lợi dựng cờ khởi nghĩa, nhưng buổi đầu lực lượng còn yếu.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.8 },
            { k: 'man', x: 90, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một người dân chài kéo lưới được một lưỡi gươm sáng loáng, đem dâng cho Lê Lợi. Sau đó, ông lại nhặt được chuôi gươm nạm ngọc trong rừng.',
        scene: {
          bg: 'river',
          items: [
            { k: 'boat', x: 60, y: 100, s: 1.2 },
            { k: 'sword', x: 110, y: 96, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 140, y: 100, s: 1.2, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Lắp lưỡi vào chuôi, gươm thần vừa khít. Có gươm thần trong tay, nghĩa quân đánh đâu thắng đó, đuổi sạch giặc ra khỏi bờ cõi.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sword', x: 80, y: 96, s: 1.6, tap: 'bounce' },
            { k: 'man', x: 125, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Đất nước thanh bình. Một hôm, vua Lê Lợi cưỡi thuyền dạo chơi trên hồ xanh biếc.',
        scene: {
          bg: 'river',
          items: [
            { k: 'boat', x: 100, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 100, y: 96, s: 1.1, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Bỗng Rùa Vàng nổi lên, cất tiếng: "Xin bệ hạ trả lại gươm thần cho Đức Long Quân." Vua hai tay dâng gươm. Rùa ngậm gươm rồi lặn sâu xuống nước.',
        scene: {
          bg: 'river',
          items: [
            { k: 'turtle', x: 80, y: 92, s: 1.7, tap: 'bounce' },
            { k: 'boat', x: 130, y: 100, s: 1.2 },
            { k: 'man', x: 130, y: 96, s: 1, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Từ đó, hồ ấy mang tên Hồ Gươm — Hồ Hoàn Kiếm. Được ai giúp thì phải biết ơn và trả lại.',
        scene: {
          bg: 'river',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'turtle', x: 100, y: 92, s: 1.5, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'so-dua',
    title: 'Sọ Dừa',
    emoji: '🥥',
    moral: 'Đừng đánh giá người khác qua vẻ bề ngoài.',
    pages: [
      {
        text: 'Có người mẹ hiền sinh ra một đứa con tròn lông lốc như quả dừa, không tay không chân, bà đặt tên là Sọ Dừa.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 95, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Sọ Dừa xin đi chăn bò cho nhà phú ông. Ai cũng coi thường, vậy mà cậu chăn rất giỏi, con bò nào cũng béo tròn.',
        scene: {
          bg: 'day',
          items: [
            { k: 'hill', x: 150, y: 96 },
            { k: 'buffalo', x: 70, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'oldWoman', x: 120, y: 100, s: 1.2, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Cô út con phú ông hiền lành, đối xử tử tế với Sọ Dừa. Còn hai cô chị thì hắt hủi, chê bai cậu đủ điều.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'girl', x: 70, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 105, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'woman', x: 135, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Sọ Dừa nhờ mẹ mang sính lễ đến hỏi cưới cô út. Đến ngày cưới, Sọ Dừa bỗng hiện nguyên hình một chàng trai khôi ngô tuấn tú.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'man', x: 90, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'girl', x: 125, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Sọ Dừa chăm chỉ học hành, thi đỗ Trạng nguyên. Hai cô chị xấu hổ vì đã coi thường cậu. Đừng bao giờ nhìn vẻ ngoài mà đánh giá một người.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'man', x: 90, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'girl', x: 125, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
];

export const getStory = (id: string) => STORIES.find((s) => s.id === id);
