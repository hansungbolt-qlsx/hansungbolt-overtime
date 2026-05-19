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
        text: 'Ngày xửa ngày xưa, ở một làng quê yên bình bên dòng sông nhỏ, có một ông cụ sống cùng các con trai đã lớn. Nhà tuy không giàu nhưng ruộng vườn cũng đủ ăn, đủ mặc.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'tree', x: 40, y: 96, s: 1.1 },
            { k: 'house', x: 130, y: 96, s: 1 },
            { k: 'oldMan', x: 95, y: 100, s: 1.5, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Chỉ tiếc một điều: mấy anh em chẳng bao giờ thuận hoà. Suốt ngày họ tị nạnh, cãi cọ. Người anh càu nhàu: "Tại em làm hỏng việc!". Người em vùng vằng: "Không, tại anh lười mới đúng!".',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 100, y: 96, s: 0.7 },
            { k: 'man', x: 70, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 110, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 150, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Ông cụ nghe mà lòng buồn rười rượi, ăn không ngon, ngủ chẳng yên. Ông tuổi đã cao, thầm lo: "Mai này ta khuất núi, anh em nó cứ chia rẽ thế này thì tan cửa nát nhà mất thôi…". Ông nghĩ mãi, rồi nghĩ ra một cách.',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 150, y: 30 },
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'oldMan', x: 110, y: 100, s: 1.5, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Sáng hôm sau, ông gọi tất cả các con lại. Ông đặt trước mặt một bó đũa thật to, buộc dây thật chặt, rồi nói nhẹ nhàng: "Các con nghe này. Con nào bẻ gãy được cả bó đũa này, cha sẽ thưởng cho một túi tiền thật lớn."',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 55, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'bundle', x: 100, y: 100, s: 2, tap: 'wobble' },
            { k: 'man', x: 150, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Nghe có thưởng, các con hớn hở. Người con cả xắn tay áo: "Để con!". Anh ôm bó đũa, gồng hết sức: "Hự!... Hự!...". Mặt đỏ tía tai mà bó đũa vẫn nằm im, chẳng hề suy chuyển.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'man', x: 80, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'bundle', x: 120, y: 100, s: 2, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Đến lượt người thứ hai, rồi người thứ ba. Ai cũng nghiến răng, vận hết sức bình sinh. Nhưng bó đũa cứ trơ trơ, dẻo dai chẳng gãy nổi một chiếc. Cuối cùng, tất cả đành thở dài, lắc đầu chịu thua.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'man', x: 60, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'bundle', x: 100, y: 100, s: 2, tap: 'wobble' },
            { k: 'man', x: 145, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Ông cụ chỉ mỉm cười hiền hậu. Ông thong thả cởi sợi dây, tháo bó đũa ra, rồi đưa cho mỗi người một chiếc. "Bây giờ, các con thử bẻ từng chiếc xem nào."',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 60, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 110, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 150, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Tách! Tách! Tách! Lần này, chiếc đũa nào cũng gãy gọn, dễ như bẻ một que kẹo. Các con ngơ ngác nhìn nhau, chưa hiểu vì sao bó đũa thì không bẻ nổi mà từng chiếc lại gãy dễ đến thế.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'man', x: 70, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 110, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 150, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Ông cụ ôn tồn dạy: "Các con thấy chưa? Một chiếc đũa lẻ loi thì yếu ớt, bẻ cái là gãy. Nhưng cả bó đũa chụm lại thì chẳng ai bẻ nổi. Anh em trong nhà cũng vậy: chia rẽ thì yếu, mà thương yêu, đoàn kết thì mạnh vô cùng."',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 70, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 115, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 150, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Các con cúi đầu, thấm thía lời cha. Từ đó, mấy anh em bảo ban nhau, thuận hoà yêu thương, không còn cãi cọ nữa. Gia đình ngày càng êm ấm, làm ăn mỗi lúc một khấm khá. Ông cụ nhìn các con mà lòng vui khôn xiết.',
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
        text: 'Ngày xửa ngày xưa, ở một xóm nhỏ nằm nép bên khu rừng xanh, có cậu bé tên là Tích Chu. Cha mẹ mất sớm, Tích Chu sống với bà trong một mái nhà tranh đơn sơ.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 35, y: 96, s: 1.2 },
            { k: 'house', x: 130, y: 96, s: 1 },
            { k: 'oldWoman', x: 90, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'boy', x: 120, y: 100, s: 1.2, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Bà thương Tích Chu lắm. Nhà nghèo, có miếng gì ngon bà cũng nhường hết cho cháu, còn mình chỉ ăn cơm với rau. Ngày ngày bà làm lụng vất vả để nuôi Tích Chu khôn lớn.',
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
        text: 'Nhưng Tích Chu mải chơi lắm. Suốt ngày cậu rong ruổi cùng đám bạn, hết trèo cây hái quả lại ra đồng bắt dế, chẳng mấy khi chịu ở nhà với bà.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 60, y: 96, s: 1.3 },
            { k: 'tree', x: 165, y: 96, s: 1.1 },
            { k: 'boy', x: 110, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một hôm, bà bị ốm nặng. Bà nằm trên giường, người nóng ran, miệng khát khô. Bà yếu ớt gọi: "Tích Chu ơi… bà khát nước quá… con lấy cho bà ngụm nước, con nhé…".',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 100, y: 100, s: 1.5, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Bà gọi một lần, hai lần, ba lần. Nhưng Tích Chu còn mải chơi tận đẩu tận đâu, chẳng nghe thấy gì. Không có ai cho uống nước, bà mệt lả đi.',
        scene: {
          bg: 'day',
          items: [
            { k: 'cloud', x: 40, y: 26 },
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 95, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'boy', x: 165, y: 100, s: 1.2, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Lạ thay, bà bỗng hoá thành một con chim nhỏ. Chim vỗ cánh, bay vụt qua cửa sổ, lên trời cao đi tìm nước uống.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'bird', x: 130, y: 46, s: 1.6, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Tích Chu chơi chán, bụng đói, chạy về gọi: "Bà ơi, cho con ăn cơm!". Nhưng nhà vắng tanh. Cậu chỉ thấy một con chim đậu trên cành cây trước sân. Cậu hốt hoảng kêu lên: "Bà ơi! Bà đừng bỏ con!".',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 40, y: 96, s: 1.3 },
            { k: 'bird', x: 130, y: 50, s: 1.5, tap: 'bounce' },
            { k: 'boy', x: 80, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Chim buồn bã đáp: "Cúc cu… Bà khát quá nên phải đi tìm nước. Tích Chu ở lại ngoan nhé.". Nói rồi chim vỗ cánh bay xa dần. Tích Chu oà lên khóc nức nở, ân hận vô cùng vì đã không nghe lời bà.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 35, y: 96, s: 1.2 },
            { k: 'tree', x: 170, y: 96, s: 1.2 },
            { k: 'bird', x: 150, y: 42, s: 1.3, tap: 'bounce' },
            { k: 'boy', x: 95, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Cậu chạy theo, băng qua rừng, lội qua suối, vừa đi vừa gọi bà. Đến khi mỏi nhừ chân, cậu ngồi bệt xuống gốc cây mà khóc nức nở.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 50, y: 96, s: 1.3 },
            { k: 'tree', x: 165, y: 96, s: 1.1 },
            { k: 'boy', x: 105, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Bỗng một bà Tiên hiền hậu hiện ra, dịu dàng bảo: "Nếu cháu muốn bà trở lại thành người, cháu phải đi thật xa, lấy cho được nước ở suối Tiên trên núi cao. Đường gian nan lắm, cháu có đi nổi không?". Tích Chu lau nước mắt, quả quyết: "Dạ, cháu đi ngay ạ!".',
        scene: {
          bg: 'river',
          items: [
            { k: 'woman', x: 70, y: 92, s: 1.5, tap: 'bounce' },
            { k: 'boy', x: 120, y: 92, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Tích Chu trèo đèo, lội suối, vượt bao gian khó. Cuối cùng cậu cũng lấy được bình nước suối Tiên mát lành mang về cho bà uống. Vừa uống xong, chim liền trở lại thành người bà hiền từ. Từ đó, Tích Chu luôn ở bên, hết lòng yêu thương và chăm sóc bà.',
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
        text: 'Ngày xửa ngày xưa, ở một làng quê nọ, có anh nông dân nghèo tên là Khoai. Anh hiền lành, thật thà lại rất khoẻ mạnh, quanh năm đi cày thuê cuốc mướn cho nhà một phú ông giàu có.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 1 },
            { k: 'man', x: 95, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Phú ông có cô con gái xinh đẹp. Thấy Khoai chăm chỉ, được việc, lão nghĩ cách giữ chân, ngọt nhạt: "Con cứ ở làm cho ta thật chăm ba năm, ta sẽ gả con gái cho con."',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 1 },
            { k: 'oldMan', x: 70, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 110, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Tin lời, Khoai làm lụng quần quật suốt ba năm trời. Trời chưa sáng đã ra đồng, tối mịt mới về. Nhờ có Khoai, nhà phú ông thóc lúa đầy bồ, trâu bò đầy chuồng.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'hill', x: 150, y: 96 },
            { k: 'man', x: 90, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Hết ba năm, Khoai mừng rỡ đến xin cưới. Nhưng phú ông tham lam đã định gả con cho nhà giàu khác. Lão nuốt lời, bịa chuyện: "Muốn cưới con gái ta, con phải lên rừng tìm cho được CÂY TRE TRĂM ĐỐT mang về đây!"',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 1 },
            { k: 'oldMan', x: 70, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 110, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Khoai thật thà tin ngay, vác dao lên rừng. Anh tìm hết bụi tre này đến bụi tre khác, cây nào cũng chỉ vài chục đốt. Làm gì có cây tre nào tới trăm đốt! Mệt và tủi, Khoai ngồi bệt xuống mà khóc.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'bamboo', x: 45, y: 96 },
            { k: 'bamboo', x: 165, y: 96 },
            { k: 'man', x: 105, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Bỗng ông Bụt râu tóc bạc phơ hiện ra, hỏi: "Vì sao con khóc?". Khoai kể hết sự tình. Bụt mỉm cười hiền hậu: "Con hãy đi chặt cho đủ một trăm đốt tre, đem lại đây cho ta."',
        scene: {
          bg: 'forest',
          items: [
            { k: 'oldMan', x: 60, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'bamboo', x: 130, y: 96, s: 1.1 },
            { k: 'man', x: 100, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Khoai chặt đủ trăm đốt tre xếp thành đống. Bụt bảo: "Con hô lên: Khắc nhập! Khắc nhập!". Vừa dứt lời, lạ chưa, trăm đốt tre tự nối liền thành một cây tre thật dài! Bụt dặn thêm câu "Khắc xuất! Khắc xuất!" để tháo rời, rồi biến mất.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'oldMan', x: 55, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'bamboo', x: 120, y: 96, s: 1.3, tap: 'wobble' },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Cây tre dài quá, vác không nổi. Khoai hô "Khắc xuất!", tre rời ra thành từng đốt. Anh bó lại, gánh về làng.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'bamboo', x: 60, y: 96 },
            { k: 'man', x: 110, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Về tới nơi, phú ông đang linh đình làm lễ cưới con gái cho nhà giàu khác! Khoai hiểu mình bị lừa. Anh xếp tre ra, hô to: "Khắc nhập!" — phú ông vừa chạy tới mắng đã bị dính chặt vào cây tre, kêu oai oái: "Ối làng nước ơi! Thả ta ra!"',
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
        text: 'Mấy người nhà giàu xúm vào gỡ cũng bị dính theo cả dây. Phú ông sợ quá, vội van xin và hứa gả con gái thật. Khoai mới hô "Khắc xuất!" thả ra. Từ đó, Khoai cưới được vợ hiền, sống hạnh phúc; còn kẻ gian dối tham lam thì phải chừa thói xấu.',
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
        text: 'Ngày xửa ngày xưa, ở đời vua Hùng, có chàng trai tên là Mai An Tiêm. Chàng khoẻ mạnh, giỏi giang, được nhà vua quý mến, nhận làm con nuôi và cho sống sung túc trong cung.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldMan', x: 70, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 110, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Mai An Tiêm chăm chỉ, của cải đầy nhà. Nhưng chàng thẳng thắn nói: "Của này là nhờ hai bàn tay con làm ra mà có." Có kẻ ghét chàng, bèn tâu vua rằng chàng kiêu ngạo, không biết ơn.',
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
        text: 'Vua nghe, nổi giận đùng đùng: "Đã vậy, ta xem ngươi tự làm ra được gì!". Vua đày cả gia đình Mai An Tiêm ra một hòn đảo hoang giữa biển, chỉ cho mang theo ít lương thực.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 70, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 115, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Hòn đảo chỉ toàn cát trắng và sóng biển. Vợ An Tiêm lo lắng khóc. Chàng ôn tồn động viên: "Mình đừng lo. Trời sinh voi, trời sinh cỏ. Cứ chịu khó, vợ chồng con cái ta nhất định sống được."',
        scene: {
          bg: 'island',
          items: [
            { k: 'boat', x: 50, y: 100, s: 1.2 },
            { k: 'man', x: 100, y: 102, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 135, y: 102, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Một hôm, An Tiêm thấy đàn chim từ xa bay tới, nhả xuống mấy hạt đen đen rồi bay đi. Chàng nghĩ: "Chim ăn được thì người chắc cũng ăn được." Anh nhặt hạt đem gieo xuống cát.',
        scene: {
          bg: 'island',
          items: [
            { k: 'bird', x: 60, y: 48, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 120, y: 102, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Ngày ngày, hai vợ chồng chăm chỉ tưới tắm, vun trồng. Ít lâu sau, hạt nảy mầm, bò lan thành dây, kết những quả tròn to, vỏ xanh thẫm.',
        scene: {
          bg: 'island',
          items: [
            { k: 'watermelon', x: 70, y: 100, s: 1.1 },
            { k: 'man', x: 110, y: 102, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 140, y: 102, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'An Tiêm bổ thử một quả. Ruột đỏ tươi, hạt đen nhánh, ăn vào ngọt lịm, mát rượi cả người. Cả nhà reo lên vui sướng. Đó chính là quả dưa hấu.',
        scene: {
          bg: 'island',
          items: [
            { k: 'watermelon', x: 80, y: 100, s: 1.7, tap: 'bounce' },
            { k: 'man', x: 130, y: 102, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Dưa ra ngày càng nhiều. An Tiêm khắc tên mình lên vỏ vài quả rồi thả trôi theo dòng nước biển, mong có người biết đến.',
        scene: {
          bg: 'island',
          items: [
            { k: 'watermelon', x: 70, y: 100, s: 1.2 },
            { k: 'man', x: 120, y: 102, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Quả dưa trôi dạt vào đất liền. Ai ăn cũng tấm tắc khen ngon, lần theo tên trên vỏ tìm ra đảo, mang gạo và đồ dùng đến đổi lấy dưa. Gia đình An Tiêm dần dần đủ đầy.',
        scene: {
          bg: 'island',
          items: [
            { k: 'watermelon', x: 60, y: 100, s: 1.2 },
            { k: 'boat', x: 130, y: 100, s: 1.3 },
          ],
        },
      },
      {
        text: 'Tin đồn về thứ quả lạ đến tai vua. Vua nếm thử, thấy ngon lạ thường, hối hận vì đã trách lầm. Vua cho thuyền ra đón cả gia đình về, ban thưởng hậu hĩnh. Từ đó nước ta có giống dưa hấu. Tự tay làm ra mới thật đáng quý.',
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
        text: 'Ngày xửa ngày xưa, ở một làng quê có cánh đồng rộng mênh mông, có bác nông dân hiền lành. Ngày ngày bác dắt con trâu của mình ra ruộng cày bừa.',
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
        text: 'Trâu tuy to khoẻ nhưng rất ngoan, chăm chỉ kéo cày giúp bác. Một hôm, có con hổ vằn từ trong rừng mò ra. Nó nấp sau bụi cây, tò mò nhìn mãi.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 50, y: 96, s: 1.2 },
            { k: 'tiger', x: 95, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'buffalo', x: 140, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Đợi bác nông dân nghỉ tay, hổ lò dò đến gần trâu, hỏi nhỏ: "Này anh trâu kia, anh to lớn khoẻ mạnh thế, sao lại chịu kéo cày khổ sở cho cái người bé tí kia?"',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tiger', x: 60, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'buffalo', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Trâu thong thả đáp: "Tại người tuy bé nhưng có TRÍ KHÔN, anh ạ." Hổ ngạc nhiên lắm: "Trí khôn là cái gì? Nó như thế nào, trông ra làm sao?"',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tiger', x: 65, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'buffalo', x: 135, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Hổ tò mò chạy tới hỏi thẳng bác nông dân: "Trí khôn của ngươi đâu? Cho ta xem một cái nào!". Bác nhìn con hổ dữ tợn, nghĩ bụng phải có mưu mới xong.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tiger', x: 70, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Bác đáp: "Trí khôn ta để quên ở nhà rồi. Để ta về lấy cho ngươi xem. Nhưng ta đi, sợ ngươi ăn mất trâu của ta. Hay là… ngươi chịu cho ta trói lại một lát nhé?". Hổ muốn xem trí khôn quá, gật đầu lia lịa.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 55, y: 96, s: 1.2 },
            { k: 'tiger', x: 85, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Bác nông dân lấy dây thừng to, trói hổ thật chặt vào một gốc cây. Trói xong xuôi đâu đấy, bác vỗ tay cười lớn: "Trí khôn của ta đây! Trí khôn của ta đây!"',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 70, y: 96, s: 1.2 },
            { k: 'tiger', x: 80, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Rồi bác chất rơm, châm lửa, hù cho hổ một phen khiếp vía. Hổ vùng vẫy dữ dội, đứt dây chạy biến vào rừng. Lửa cháy sém, để lại trên mình hổ những vằn đen dài.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 55, y: 96, s: 1.1 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'tiger', x: 145, y: 100, s: 1.4, tap: 'spin' },
          ],
        },
      },
      {
        text: 'Từ đó, loài hổ nào trên lưng cũng có những vằn đen. Và câu chuyện này nhắc các bé rằng: trí khôn còn quý hơn cả sức mạnh.',
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
        text: 'Ngày xửa ngày xưa, ở một mái nhà tranh nhỏ ven rừng, có hai mẹ con nghèo sống nương tựa vào nhau. Mẹ tần tảo sớm hôm nuôi con; cô bé thì ngoan ngoãn, hiếu thảo, hết mực thương mẹ.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 75, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'girl', x: 110, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một hôm, người mẹ bỗng lâm bệnh nặng, nằm liệt giường, người gầy rộc, mặt xanh xao. Cô bé lo lắng vô cùng, ngày đêm túc trực bên giường chăm sóc mẹ.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 95, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'girl', x: 130, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Bệnh mẹ mỗi ngày một nặng thêm. Cô bé quyết tâm lên đường đi tìm thầy thuốc giỏi để cứu mẹ. Em đi mãi, đi mãi, băng qua bao cánh rừng.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 45, y: 96, s: 1.2 },
            { k: 'tree', x: 165, y: 96, s: 1.1 },
            { k: 'girl', x: 105, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Dọc đường, em gặp một cụ già râu tóc bạc phơ, dáng vẻ hiền hậu. Nghe em kể chuyện, cụ bảo: "Trong rừng sâu có một bông hoa trắng. Hoa ấy có bao nhiêu cánh thì mẹ con sẽ sống thêm được bấy nhiêu năm. Con hãy đi tìm."',
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
        text: 'Cô bé mừng rỡ, cảm ơn cụ rồi vội vã đi sâu vào rừng. Em vạch từng lùm cây tìm kiếm. Cuối cùng, em cũng thấy một bông hoa trắng nhỏ xinh nở bên gốc cây.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 45, y: 96, s: 1.2 },
            { k: 'flower', x: 95, y: 96, s: 1.5, tap: 'wobble' },
            { k: 'girl', x: 135, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Nhưng em đếm đi đếm lại, bông hoa chỉ có vẻn vẹn vài cánh. Cô bé bật khóc nức nở: "Trời ơi, vậy mẹ con chỉ sống được mấy năm nữa thôi sao?"',
        scene: {
          bg: 'forest',
          items: [
            { k: 'flower', x: 90, y: 96, s: 1.6, tap: 'wobble' },
            { k: 'girl', x: 130, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Thương mẹ quá, cô bé nảy ra một cách. Em nhẹ nhàng, tỉ mỉ xé mỗi cánh hoa thành thật nhiều cánh nhỏ li ti, xé mãi cho đến khi bông hoa có không biết bao nhiêu là cánh.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'flower', x: 95, y: 96, s: 1.9, tap: 'spin' },
            { k: 'girl', x: 138, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Em nâng niu mang bông hoa về nhà. Kỳ lạ thay, vừa về tới nơi, mẹ em đã ngồi dậy được, bệnh tình thuyên giảm trông thấy, rồi khỏi hẳn lúc nào không hay.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'flower', x: 60, y: 96, s: 1.3 },
            { k: 'oldWoman', x: 100, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'girl', x: 135, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Bông hoa trắng nhiều cánh ấy về sau người ta gọi là hoa cúc trắng. Nhờ tấm lòng hiếu thảo, cô bé đã giữ được mẹ sống thật lâu bên mình. Lòng hiếu thảo quả đã làm cảm động cả đất trời.',
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
        text: 'Ngày xửa ngày xưa, ở một làng quê nọ, nhà vua muốn tìm người tài giỏi giúp nước. Vua sai một viên quan đi khắp nơi, đặt ra những câu đố thật khó để thử tài mọi người.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'man', x: 100, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Đi mãi chẳng tìm được ai, một hôm viên quan qua cánh đồng, thấy hai cha con đang cày ruộng. Ông hỏi xoáy: "Này, trâu của lão một ngày cày được mấy đường?"',
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
        text: 'Người cha còn lúng túng thì cậu con trai nhỏ đã nhanh nhảu hỏi vặn lại: "Thưa ông, thế ngựa của ông một ngày đi được mấy bước ạ?". Viên quan ngẩn người, biết đã gặp được người tài.',
        scene: {
          bg: 'day',
          items: [
            { k: 'boy', x: 80, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'man', x: 125, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Quan về tâu vua. Vua muốn thử thêm, bèn ban cho làng em ba con trâu đực và ba thúng gạo nếp, ra lệnh: phải nuôi sao cho ba con trâu ấy đẻ thành chín con, không thì cả làng chịu tội.',
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
        text: 'Cả làng lo sốt vó, chẳng ai biết tính sao. Riêng em bé tỉnh bơ, bảo cha thưa với làng cứ làm thịt hai con trâu, đồ hai thúng gạo nếp cho hai cha con ăn lấy sức, rồi lên kinh gặp vua.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'boy', x: 110, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'man', x: 145, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Đến kinh đô, em bé lẻn vào sân rồng rồi khóc ầm ĩ. Vua hỏi vì sao khóc. Em mếu máo: "Tâu bệ hạ, mẹ con mất sớm, con muốn có em mà cha con nhất định không chịu đẻ em bé cho con!"',
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
        text: 'Vua bật cười lớn: "Cha mày là đàn ông, đẻ làm sao được!". Em bé liền đáp ngay: "Vậy sao bệ hạ lại bắt ba con trâu đực làng con phải đẻ thành chín con ạ?". Vua nghe vậy, biết em nói rất có lý.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 75, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'boy', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Vua vẫn muốn thử lần nữa, đố em xâu sợi chỉ mảnh qua con ốc vặn ruột rỗng. Em bé hát một câu vè vui, rồi bày cách buộc chỉ vào con kiến, bôi tí mật một đầu cho kiến bò xuyên qua. Quả nhiên xâu được!',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 75, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'boy', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Vua hết lời khen ngợi, ban thưởng thật hậu và phong em làm trạng nguyên nhỏ tuổi. Em bé thông minh đã dùng cái khôn của mình cứu cả làng thoát tội. Trí thông minh thật đáng quý.',
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
        text: 'Ngày xửa ngày xưa, ở một ngôi làng nọ, có hai anh em mồ côi cha mẹ. Khi chia gia tài, người anh tham lam giành hết ruộng vườn, nhà cửa, chỉ chia cho người em một túp lều tranh và một cây khế ở góc vườn.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.8 },
            { k: 'tree', x: 55, y: 96, s: 1.2 },
            { k: 'man', x: 90, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'man', x: 125, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Người em hiền lành, chẳng oán trách lấy nửa lời. Ngày ngày anh chăm chút cho cây khế. Cây lớn nhanh, ra hoa kết trái, sai trĩu những quả khế chín vàng thơm ngọt.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'tree', x: 80, y: 96, s: 1.4 },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một hôm, có con chim lớn lạ từ đâu bay đến, sà xuống ăn khế lia lịa. Người em buồn rầu nói: "Chim ơi, chim ăn hết khế thì vợ chồng tôi lấy gì mà sống?"',
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
        text: 'Chim bỗng cất tiếng người: "Ăn một quả, trả một cục vàng. May túi ba gang, mang đi mà đựng." Người em nghe lời, may một chiếc túi vừa đúng ba gang tay.',
        scene: {
          bg: 'day',
          items: [
            { k: 'bird', x: 80, y: 58, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Sáng hôm sau, chim đến thật. Chim cõng người em bay qua biển, tới một hòn đảo lấp lánh toàn vàng bạc châu báu. Anh chỉ nhặt vừa đầy chiếc túi ba gang rồi leo lên lưng chim trở về.',
        scene: {
          bg: 'island',
          items: [
            { k: 'gold', x: 70, y: 100, s: 1.6 },
            { k: 'bird', x: 120, y: 50, s: 1.4, tap: 'bounce' },
            { k: 'man', x: 150, y: 102, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Từ đó, vợ chồng người em sống đủ đầy nhưng vẫn hiền lành, chăm chỉ và hay giúp đỡ bà con xóm làng.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'man', x: 85, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Người anh nghe chuyện, lòng tham nổi lên. Hắn nằng nặc đòi đổi hết cả gia tài để lấy túp lều và cây khế của em. Người em thật thà bằng lòng ngay.',
        scene: {
          bg: 'day',
          items: [
            { k: 'tree', x: 70, y: 96, s: 1.2 },
            { k: 'house', x: 150, y: 96, s: 0.8 },
            { k: 'man', x: 100, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Mùa khế chín, chim lại đến ăn. Người anh giả vờ than nghèo kể khổ. Chim cũng nói y như cũ: "Ăn một quả, trả một cục vàng. May túi ba gang, mang đi mà đựng."',
        scene: {
          bg: 'day',
          items: [
            { k: 'tree', x: 70, y: 96, s: 1.3 },
            { k: 'bird', x: 130, y: 50, s: 1.6, tap: 'bounce' },
            { k: 'man', x: 100, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Nhưng người anh tham lam may hẳn một cái túi to đến sáu, bảy gang. Ra tới đảo vàng, hắn nhét vàng đầy túi, lại còn giắt thêm khắp người cho thật nhiều.',
        scene: {
          bg: 'island',
          items: [
            { k: 'gold', x: 70, y: 100, s: 1.7 },
            { k: 'man', x: 125, y: 102, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Túi vàng nặng trĩu. Chim cõng nặng quá, vỗ cánh không nổi. Ra tới giữa biển, chim chao nghiêng, người anh tham trượt tay rơi tõm xuống nước, phải vùng vẫy bơi mãi mới vào được bờ, mất sạch cả vàng. Tham thì thâm là vậy!',
        scene: {
          bg: 'island',
          items: [
            { k: 'gold', x: 60, y: 100, s: 1.3 },
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
