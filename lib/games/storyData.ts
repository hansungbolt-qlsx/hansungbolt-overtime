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
        text: 'Ngày xửa ngày xưa, ở đời vua Hùng, nhà vua tuổi đã cao, muốn chọn trong số các con một người tài đức để truyền ngôi báu. Vua có tới hơn hai mươi người con trai.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldMan', x: 90, y: 100, s: 1.5, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Vua cho gọi tất cả hoàng tử lại và phán: "Năm nay, nhân ngày lễ lớn, ai dâng được lễ vật vừa ngon vừa ý nghĩa nhất để cúng Trời Đất, tổ tiên, ta sẽ truyền ngôi cho người ấy."',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldMan', x: 75, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Các hoàng tử thi nhau cho người lên rừng săn thú lạ, xuống biển tìm hải sản quý, mong có món thật sang trọng để dâng vua cha.',
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
        text: 'Riêng hoàng tử thứ mười tám tên Lang Liêu thì nghèo, mẹ mất sớm, quanh nhà chỉ có lúa, gạo, đỗ xanh. Chàng buồn rầu vì chẳng biết lấy gì làm lễ vật cho phải.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Một đêm, Lang Liêu nằm mơ thấy một vị thần hiện ra mách bảo: "Trong trời đất, không gì quý bằng hạt gạo nuôi sống con người. Con hãy lấy gạo nếp mà làm bánh dâng vua."',
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
        text: 'Tỉnh dậy, Lang Liêu mừng lắm. Chàng chọn thứ gạo nếp ngon nhất, lấy đỗ xanh và thịt làm nhân, gói trong lá dong thành thứ bánh hình vuông, rồi đem luộc thật lâu.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Chàng lại đồ xôi, giã thật nhuyễn, nặn thành thứ bánh hình tròn trắng mịn. Bánh vuông tượng cho Đất, bánh tròn tượng cho Trời, gói trọn lòng biết ơn cha mẹ và đất trời.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 60, y: 96, s: 0.85 },
            { k: 'man', x: 110, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Ngày dâng lễ, mâm cao cỗ đầy của các hoàng tử bày la liệt. Đến lượt Lang Liêu, chàng chỉ có hai thứ bánh giản dị. Vua nếm thử, gật gù khen ngon, rồi nghe Lang Liêu thưa rõ ý nghĩa.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 75, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Vua vô cùng hài lòng, quyết định truyền ngôi cho Lang Liêu. Từ đó, dân ta có tục gói bánh chưng, giã bánh dày mỗi dịp Tết. Lòng hiếu thảo và sự sáng tạo thật đáng quý.',
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
        text: 'Ngày xửa ngày xưa, ở một khu rừng nọ, có chàng tiều phu nghèo tên là Cuội, ngày ngày vác rìu vào rừng đốn củi đem bán nuôi thân.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 50, y: 96, s: 1.3 },
            { k: 'tree', x: 160, y: 96, s: 1.1 },
            { k: 'man', x: 105, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một hôm, Cuội tình cờ bắt gặp một cây đa lạ. Lá cây có phép màu: đắp lên người ốm là khỏi bệnh, cứu được cả người vừa tắt thở. Từ đó, Cuội mang lá đa đi cứu sống biết bao nhiêu người.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 90, y: 96, s: 1.7, tap: 'wobble' },
            { k: 'man', x: 140, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Cuội đem cây đa thần về trồng ở góc vườn. Chàng dặn vợ thật kỹ: "Cây quý lắm đấy. Nhớ chỉ tưới bằng nước sạch thôi. Tuyệt đối đừng bao giờ tưới nước bẩn vào gốc, nghe chưa!"',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'tree', x: 55, y: 96, s: 1.3 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 125, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Người vợ vâng dạ. Nhưng ít lâu sau, một hôm mải việc, chị quên bẵng lời chồng dặn, vô ý hắt nhầm cả chậu nước bẩn vào gốc cây đa.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'tree', x: 70, y: 96, s: 1.3 },
            { k: 'woman', x: 115, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Lạ thay, cây đa bỗng rung chuyển dữ dội, rễ bật khỏi mặt đất, rồi từ từ nhấc bổng lên, bay lên trời cao!',
        scene: {
          bg: 'day',
          items: [
            { k: 'tree', x: 90, y: 70, s: 1.4, tap: 'wobble' },
            { k: 'woman', x: 135, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Vừa lúc đó, Cuội gánh củi về tới. Thấy cây đa thần đang bay lên, chàng hốt hoảng vứt vội gánh củi, chạy tới nắm chặt lấy rễ cây mà ra sức kéo lại.',
        scene: {
          bg: 'day',
          items: [
            { k: 'tree', x: 90, y: 64, s: 1.3, tap: 'wobble' },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Nhưng cây đa cứ bay lên mãi, kéo theo cả chú Cuội đang bám trên rễ, đưa chàng lên tận cung trăng xa tít.',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 150, y: 32 },
            { k: 'tree', x: 90, y: 60, s: 1.2, tap: 'wobble' },
            { k: 'man', x: 95, y: 100, s: 1.2, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Từ đó, mỗi đêm rằm trăng sáng, ngước nhìn lên ông trăng, ta sẽ thấy một bóng người ngồi dưới gốc cây — đó chính là chú Cuội nhớ nhà. Câu chuyện nhắc ta: lời dặn dò cần phải nhớ kỹ và làm theo.',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 100, y: 42, s: 1.7, tap: 'wobble' },
            { k: 'tree', x: 55, y: 96, s: 1 },
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
        text: 'Ngày xửa ngày xưa, ở một làng nọ dưới gốc cây đa cổ thụ, có chàng trai mồ côi tên là Thạch Sanh. Chàng sống một mình, ngày ngày lên rừng đốn củi, tính tình hiền lành mà sức khoẻ thì hơn người.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 80, y: 96, s: 1.6, tap: 'wobble' },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Trong vùng có gã bán rượu tên Lý Thông gian xảo. Thấy Thạch Sanh khoẻ mạnh, hắn giả vờ thân tình, kết nghĩa anh em để lợi dụng sức của chàng.',
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
        text: 'Bấy giờ, trong vùng có con chằn tinh hung dữ, mỗi năm bắt dân làng nộp một mạng người. Năm ấy đến lượt Lý Thông. Hắn lừa Thạch Sanh: "Em đi canh miếu thay anh một đêm nhé." Thạch Sanh thật thà nhận lời.',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 40, y: 30 },
            { k: 'snake', x: 130, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 80, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Đêm xuống, chằn tinh hiện ra, gầm vang: "Kẻ nào to gan dám đến đây? Ta sẽ nuốt chửng ngươi!". Thạch Sanh chẳng hề run sợ, dũng cảm chống trả và diệt được con quái vật, cứu cả vùng thoát nạn.',
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
        text: 'Lý Thông gian manh cướp luôn công của Thạch Sanh, đem đầu chằn tinh về tâu vua để lĩnh thưởng, được phong làm quan to. Còn Thạch Sanh thì lủi thủi trở về gốc đa.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 90, y: 96, s: 1.5 },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Ít lâu sau, công chúa con vua đang dạo chơi thì bị một con đại bàng khổng lồ quắp đi mất. Thạch Sanh tình cờ trông thấy, liền lần theo dấu, cứu được công chúa khỏi hang sâu.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'mountain', x: 80, y: 96, s: 1.3 },
            { k: 'bird', x: 60, y: 44, s: 1.6, tap: 'spin' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Nhưng Lý Thông một lần nữa tráo trở, lấp cửa hang nhốt Thạch Sanh lại để cướp công cứu công chúa. Thạch Sanh bị kẹt sâu trong hang tối.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'mountain', x: 100, y: 96, s: 1.4 },
            { k: 'man', x: 120, y: 100, s: 1.2, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Trong hang, Thạch Sanh cứu được con trai vua Thuỷ Tề đang bị giam. Để tạ ơn, vua Thuỷ Tề tặng chàng một cây đàn thần kỳ diệu.',
        scene: {
          bg: 'river',
          items: [
            { k: 'gold', x: 70, y: 96, s: 1.3 },
            { k: 'man', x: 120, y: 92, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Từ ngày được cứu về, công chúa buồn rầu chẳng nói năng gì. Còn Thạch Sanh lại bị Lý Thông vu oan, bắt nhốt vào ngục.',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 150, y: 32 },
            { k: 'man', x: 90, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Trong ngục, Thạch Sanh ôm đàn thần gảy lên. Tiếng đàn vang tới hoàng cung, giãi bày hết nỗi oan ức. Công chúa nghe đàn liền vui khoẻ trở lại, xin vua cho gặp người gảy đàn.',
        scene: {
          bg: 'night',
          items: [
            { k: 'moon', x: 40, y: 30 },
            { k: 'man', x: 95, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Sự thật sáng tỏ: Thạch Sanh được minh oan, kẻ gian Lý Thông bị trừng trị thích đáng. Vua gả công chúa cho Thạch Sanh. Người hiền lành, dũng cảm cuối cùng đã được đền đáp xứng đáng.',
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
        text: 'Ngày xửa ngày xưa, ở một làng quê nọ, có cô Tấm hiền lành, xinh xắn. Tấm mồ côi mẹ từ nhỏ, cha cũng mất sớm, phải sống với dì ghẻ và cô em cùng cha khác mẹ tên là Cám.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'girl', x: 70, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 105, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'girl', x: 135, y: 100, s: 1.2, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Dì ghẻ rất cay nghiệt. Bà bắt Tấm làm lụng suốt ngày: mò cua bắt ốc, chăn trâu cắt cỏ, gánh nước thổi cơm. Còn Cám thì được nuông chiều, chỉ rong chơi.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'girl', x: 90, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'woman', x: 130, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Một hôm, dì sai hai chị em đi hớt tép, hứa ai được đầy giỏ sẽ thưởng cái yếm đỏ. Tấm chăm chỉ bắt đầy giỏ. Cám mải chơi nên chẳng được con nào.',
        scene: {
          bg: 'river',
          items: [
            { k: 'girl', x: 75, y: 92, s: 1.3, tap: 'bounce' },
            { k: 'girl', x: 120, y: 92, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Cám bèn lừa: "Chị Tấm ơi, đầu chị lấm bùn kìa, chị hụp xuống ao gội cho sạch kẻo về mẹ mắng." Tấm tin lời lội xuống ao. Lúc lên, giỏ tép đã bị Cám trút sạch mang về lĩnh thưởng. Tấm ngồi bên bờ ao mà khóc.',
        scene: {
          bg: 'river',
          items: [
            { k: 'girl', x: 90, y: 92, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Bụt hiện ra hỏi: "Vì sao con khóc?". Tấm kể hết. Bụt bảo nhìn trong giỏ xem còn gì. Còn đúng một con cá bống. Bụt dặn: "Con đem bống về thả xuống giếng, mỗi bữa bớt cơm cho bống ăn, gọi: Bống bống bang bang…"',
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
        text: 'Tấm nuôi bống làm bạn, sớm hôm có tiếng nói thủ thỉ cho đỡ buồn. Nhưng mẹ con Cám rình biết, lừa bắt mất cá bống. Tấm lại khóc. Bụt bảo nhặt xương bống bỏ vào bốn cái lọ, chôn dưới chân giường.',
        scene: {
          bg: 'river',
          items: [
            { k: 'woman', x: 70, y: 92, s: 1.3, tap: 'wobble' },
            { k: 'girl', x: 120, y: 92, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Ít lâu sau, nhà vua mở hội lớn. Dì ghẻ trộn một đấu thóc lẫn một đấu gạo, bắt Tấm nhặt riêng ra xong mới được đi. Tấm tủi thân khóc. Đàn chim sẻ của Bụt liền sà xuống nhặt giúp, loáng cái là xong.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'bird', x: 70, y: 48, s: 1.2, tap: 'bounce' },
            { k: 'girl', x: 110, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Tấm đào mấy cái lọ lên thì thấy có quần áo đẹp, đôi hài thêu xinh xắn và cả một con ngựa. Tấm mừng rỡ thay đồ, cưỡi ngựa đi trẩy hội.',
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
        text: 'Khi phóng ngựa qua cầu, Tấm vô ý đánh rơi một chiếc hài xuống nước. Đoàn voi của nhà vua đi qua cứ đứng lại không chịu bước. Vua sai vớt lên thì được chiếc hài xinh xắn.',
        scene: {
          bg: 'river',
          items: [
            { k: 'boat', x: 70, y: 100, s: 1.2 },
            { k: 'man', x: 120, y: 96, s: 1.2, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Vua truyền: "Hễ ai đi vừa chiếc hài này, ta sẽ cưới làm hoàng hậu." Ai ướm cũng không vừa. Đến lượt Tấm, chân đi vừa khít như in. Vua mừng rỡ rước Tấm về cung. Mẹ con Cám tức tối lắm.',
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
        text: 'Mẹ con Cám lập mưu hãm hại Tấm hết lần này đến lần khác. Nhưng Tấm hiền lành nên luôn được Bụt che chở: khi thì hoá thành chim vàng anh hót cho vua nghe, khi thì hoá thành cây xoan đào toả bóng mát, rồi nương trong quả thị thơm về ở với một bà cụ hiền.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 60, y: 96, s: 1.4 },
            { k: 'bird', x: 120, y: 48, s: 1.4, tap: 'bounce' },
            { k: 'oldWoman', x: 150, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Một hôm vua đi qua, ghé hàng nước của bà cụ, nhận ra miếng trầu têm cánh phượng quen thuộc của Tấm. Vua tìm được Tấm, vui mừng đón nàng trở lại cung. Mẹ con Cám gian ác thì xấu hổ ê chề, lặng lẽ bỏ làng đi biệt. Ở hiền thì gặp lành, ở ác sẽ gặp ác.',
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
        text: 'Ngày xửa ngày xưa, ở đời vua Hùng thứ mười tám, nhà vua có một nàng công chúa tên là Mỵ Nương, người đẹp như hoa, tính nết hiền dịu. Vua rất mực thương yêu, muốn kén cho con một người chồng thật xứng đáng.',
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
        text: 'Tin loan ra, có hai chàng trai cùng đến cầu hôn. Một người là Sơn Tinh — thần Núi, vẫy tay là rừng núi mọc lên. Người kia là Thủy Tinh — thần Nước, hô một tiếng là mưa gió ào ào. Cả hai đều tài giỏi ngang nhau.',
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
        text: 'Vua phân vân không biết chọn ai, bèn ra điều kiện: "Ngày mai, ai mang lễ vật tới trước thì ta gả Mỵ Nương cho. Lễ vật gồm voi chín ngà, gà chín cựa, ngựa chín hồng mao."',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'oldMan', x: 80, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'man', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Mới tờ mờ sáng, Sơn Tinh đã đem đầy đủ lễ vật đến trước. Vua giữ lời, gả Mỵ Nương cho Sơn Tinh. Chàng vui mừng rước nàng về núi cao.',
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
        text: 'Thủy Tinh đến sau, không cưới được Mỵ Nương thì tức giận đùng đùng. Thần thét lên: "Sơn Tinh! Ngươi hãy trả vợ lại cho ta!"',
        scene: {
          bg: 'river',
          items: [
            { k: 'man', x: 90, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'mountain', x: 140, y: 96, s: 1.2 },
          ],
        },
      },
      {
        text: 'Thủy Tinh hô mưa gọi gió, dâng nước cuồn cuộn lên đánh Sơn Tinh. Nước ngập đồng ruộng, làng mạc, dâng lên tận lưng đồi.',
        scene: {
          bg: 'river',
          items: [
            { k: 'man', x: 90, y: 96, s: 1.3, tap: 'wobble' },
            { k: 'mountain', x: 140, y: 96, s: 1.2 },
          ],
        },
      },
      {
        text: 'Sơn Tinh không hề nao núng. Thần bốc từng quả đồi, dời từng dãy núi, dựng thành luỹ cao ngăn chặn dòng nước lũ.',
        scene: {
          bg: 'river',
          items: [
            { k: 'mountain', x: 70, y: 96, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 120, y: 96, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Hai bên đánh nhau ròng rã. Nước dâng cao bao nhiêu, núi lại vươn cao lên bấy nhiêu. Cuối cùng Thủy Tinh kiệt sức, đành rút quân chịu thua.',
        scene: {
          bg: 'river',
          items: [
            { k: 'mountain', x: 80, y: 96, s: 1.5, tap: 'wobble' },
            { k: 'man', x: 130, y: 96, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Nhưng năm nào Thủy Tinh cũng nhớ thù, lại dâng nước lên đánh Sơn Tinh một lần — đó chính là lý do nước ta hằng năm có mùa mưa lũ. Cứ kiên cường, vững vàng thì sẽ vượt qua tất cả.',
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
        text: 'Ngày xửa ngày xưa, ở vùng đất Thăng Long, giặc ngoại xâm tràn sang quấy phá, dân ta vô cùng khổ sở. Ông Lê Lợi nổi lên dựng cờ khởi nghĩa, nhưng buổi đầu quân ít thế yếu, đánh trận nào cũng khó.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.8 },
            { k: 'man', x: 90, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Thấy vậy, Đức Long Quân ở dưới nước quyết định cho nghĩa quân mượn một thanh gươm thần để đánh đuổi giặc, cứu dân cứu nước.',
        scene: {
          bg: 'river',
          items: [
            { k: 'sword', x: 95, y: 92, s: 1.6, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Có người dân chài tên Lê Thận, đêm đêm đi kéo lưới. Ba lần buông lưới, ba lần kéo lên đều chỉ thấy một thanh sắt. Nhìn kỹ, hoá ra là một lưỡi gươm sáng loáng! Ông liền đem dâng cho Lê Lợi.',
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
        text: 'Ít lâu sau, Lê Lợi chạy giặc qua một khu rừng, chợt thấy ánh sáng lạ trên ngọn cây. Trèo lên xem, ông nhặt được một cái chuôi gươm nạm ngọc lấp lánh.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 90, y: 96, s: 1.5 },
            { k: 'sword', x: 95, y: 60, s: 1.1, tap: 'wobble' },
            { k: 'man', x: 140, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Đem lưỡi gươm tra vào chuôi, vừa khít như đo sẵn. Trên lưỡi gươm còn khắc hai chữ "Thuận Thiên" — ý trời trao gươm báu để giúp dân giúp nước.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sword', x: 95, y: 96, s: 1.7, tap: 'bounce' },
            { k: 'man', x: 140, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Từ ngày có gươm thần, nhuệ khí nghĩa quân tăng vọt. Lê Lợi cầm gươm xông trận, đánh đâu thắng đó, đuổi sạch quân giặc ra khỏi bờ cõi. Đất nước trở lại thanh bình.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'sword', x: 80, y: 96, s: 1.6, tap: 'bounce' },
            { k: 'man', x: 125, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một năm sau ngày thắng giặc, vua Lê Lợi cưỡi thuyền rồng dạo chơi trên hồ Tả Vọng xanh biếc giữa kinh thành.',
        scene: {
          bg: 'river',
          items: [
            { k: 'boat', x: 100, y: 100, s: 1.6, tap: 'wobble' },
            { k: 'man', x: 100, y: 96, s: 1.1, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Bỗng một con Rùa Vàng to lớn nổi lên mặt nước, cất tiếng: "Xin bệ hạ hoàn lại gươm thần cho Đức Long Quân." Vua hiểu ý, hai tay nâng gươm trả. Rùa Vàng ngậm lấy gươm rồi từ từ lặn sâu xuống đáy hồ.',
        scene: {
          bg: 'river',
          items: [
            { k: 'turtle', x: 80, y: 92, s: 1.8, tap: 'bounce' },
            { k: 'boat', x: 135, y: 100, s: 1.2 },
            { k: 'man', x: 135, y: 96, s: 1, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Để nhớ chuyện trả gươm, từ đó hồ ấy được gọi là Hồ Gươm, hay Hồ Hoàn Kiếm, vẫn còn ở giữa thủ đô đến tận ngày nay. Được ai giúp đỡ thì phải biết ơn và biết trả lại.',
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
        text: 'Ngày xửa ngày xưa, ở một làng quê nọ, có hai vợ chồng nghèo hiền lành nhưng hiếm muộn, đã già mà vẫn chưa có con. Một hôm, người vợ uống nước đựng trong cái sọ dừa rồi mang thai.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 100, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Đến ngày sinh, bà sinh ra một đứa bé tròn lông lốc như quả dừa, không có chân tay. Bà buồn, định bỏ đi. Đứa bé liền cất tiếng: "Mẹ ơi, con là người đấy. Mẹ đừng bỏ con tội nghiệp!". Bà thương quá, giữ lại nuôi, đặt tên là Sọ Dừa.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 110, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Sọ Dừa lớn lên nhưng vẫn cứ tròn xoe, lăn lông lốc. Nhà nghèo, cậu xin mẹ cho đi chăn bò thuê cho nhà phú ông.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'oldWoman', x: 90, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Ai cũng coi thường, nghĩ cậu chẳng làm được trò trống gì. Vậy mà lạ thay, đàn bò cậu chăn con nào con nấy béo tròn, no căng. Phú ông mừng lắm.',
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
        text: 'Phú ông có ba cô con gái. Hai cô chị kiêu kỳ, hắt hủi, chê bai Sọ Dừa đủ điều. Chỉ riêng cô út hiền lành, hay mang cơm và đối xử tử tế với cậu.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'girl', x: 65, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'woman', x: 100, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'woman', x: 132, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Cô út tình cờ biết Sọ Dừa thật ra là một chàng trai tuấn tú, chỉ khoác lớp vỏ xấu xí bên ngoài. Sọ Dừa bèn nhờ mẹ mang sính lễ đến hỏi cưới cô út.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'oldWoman', x: 80, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'girl', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Hai cô chị bĩu môi cười chê. Nhưng đến ngày cưới, trước sự ngỡ ngàng của mọi người, Sọ Dừa bỗng trút bỏ lớp vỏ, hiện nguyên hình một chàng trai khôi ngô, khoẻ mạnh.',
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
        text: 'Sọ Dừa chăm chỉ dùi mài kinh sử, đi thi và đỗ Trạng nguyên, được vua trọng dụng. Hai vợ chồng chàng sống bên nhau hạnh phúc.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'man', x: 90, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'girl', x: 125, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Hai cô chị thấy vậy vừa ghen tị vừa xấu hổ vì trước kia đã coi thường cậu. Câu chuyện nhắc các bé: đừng bao giờ nhìn vẻ bề ngoài mà vội đánh giá một con người.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'man', x: 85, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'girl', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'rua-va-tho',
    title: 'Rùa và Thỏ',
    emoji: '🐢',
    moral: 'Chậm mà kiên trì sẽ thắng kẻ tài giỏi mà chủ quan.',
    pages: [
      {
        text: 'Ngày xửa ngày xưa, ở một khu rừng xanh tươi, có chú Thỏ chạy nhanh như gió. Thỏ rất kiêu căng, gặp ai cũng vênh mặt khoe tài chạy của mình.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 50, y: 96, s: 1.2 },
            { k: 'rabbit', x: 110, y: 100, s: 1.6, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một hôm, Thỏ gặp Rùa đang chậm rãi bò trên đường. Thỏ cười nhạo: "Ê Rùa! Bò chậm như sên thế kia thì sống làm gì cho phí!"',
        scene: {
          bg: 'forest',
          items: [
            { k: 'rabbit', x: 70, y: 100, s: 1.6, tap: 'wobble' },
            { k: 'turtle', x: 130, y: 96, s: 1.6, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Rùa không hề giận, điềm tĩnh đáp: "Anh Thỏ đừng vội khinh tôi. Hay là tôi với anh thử chạy thi một trận, xem ai về đích trước nào?"',
        scene: {
          bg: 'forest',
          items: [
            { k: 'rabbit', x: 75, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'turtle', x: 130, y: 96, s: 1.7, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Thỏ phá lên cười khoái chí: "Ha ha! Thi với ta ư? Được thôi, để ta cho ngươi biết thế nào là nhanh!". Cả khu rừng kéo đến xem.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 40, y: 96, s: 1.1 },
            { k: 'rabbit', x: 90, y: 100, s: 1.6, tap: 'bounce' },
            { k: 'turtle', x: 140, y: 96, s: 1.5, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Hiệu lệnh vang lên. Thỏ vụt đi như tên bắn, loáng cái đã bỏ Rùa lại tít đằng sau. Còn Rùa thì cứ cặm cụi bò từng bước, từng bước một.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'rabbit', x: 60, y: 100, s: 1.6, tap: 'bounce' },
            { k: 'turtle', x: 150, y: 96, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Chạy được nửa đường, Thỏ ngoái lại chẳng thấy Rùa đâu. Nó nghĩ: "Rùa còn lâu mới tới. Ta chợp mắt một lát cho khoẻ đã." Rồi Thỏ nằm dưới gốc cây ngủ khò khò.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 90, y: 96, s: 1.4 },
            { k: 'rabbit', x: 95, y: 100, s: 1.6, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Trong khi đó, Rùa vẫn không hề nghỉ. Bước chậm mà chắc, Rùa lặng lẽ bò ngang qua chỗ Thỏ đang ngủ, rồi tiến dần về phía đích.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 60, y: 96, s: 1.2 },
            { k: 'turtle', x: 120, y: 96, s: 1.6, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Thỏ giật mình tỉnh dậy thì trời đã xế chiều. Nó hoảng hốt phóng như bay. Nhưng muộn mất rồi — Rùa đã chạm đích từ lúc nào, giữa tiếng reo hò của cả khu rừng.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'rabbit', x: 60, y: 100, s: 1.6, tap: 'spin' },
            { k: 'turtle', x: 140, y: 96, s: 1.6, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Thỏ xấu hổ cúi gằm mặt. Từ đó nó không còn dám kiêu căng nữa. Câu chuyện nhắc các bé: chậm mà kiên trì, bền bỉ sẽ thắng kẻ tài giỏi mà chủ quan, lười biếng.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'rabbit', x: 80, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'turtle', x: 130, y: 96, s: 1.6, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'khan-do',
    title: 'Cô bé quàng khăn đỏ',
    emoji: '🧣',
    moral: 'Phải vâng lời cha mẹ và cảnh giác với người lạ.',
    pages: [
      {
        text: 'Ngày xửa ngày xưa, ở một ngôi làng ven rừng, có cô bé rất ngoan, lúc nào cũng đội chiếc khăn màu đỏ mẹ may cho. Vì thế mọi người gọi em là Cô bé quàng khăn đỏ.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'girl', x: 100, y: 100, s: 1.4, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một hôm, mẹ dặn: "Con mang giỏ bánh sang biếu bà ngoại đang ốm nhé. Nhớ đi thẳng đường, đừng la cà, đừng nói chuyện với người lạ trong rừng." Khăn đỏ vâng dạ rồi đi.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'woman', x: 80, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'girl', x: 115, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Vào tới rừng, một con Sói to lông xám lừ lừ xuất hiện. Sói giả giọng ngọt ngào: "Chào cô bé, cô đi đâu một mình thế?". Quên mất lời mẹ dặn, Khăn đỏ thật thà kể hết.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 45, y: 96, s: 1.2 },
            { k: 'wolf', x: 90, y: 100, s: 1.6, tap: 'wobble' },
            { k: 'girl', x: 135, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Sói gian xảo nghĩ thầm rồi nói: "Ồ, đường kia có nhiều hoa đẹp lắm, cô hái mấy bông tặng bà đi." Khăn đỏ ham hái hoa nên đi chậm lại. Còn Sói chạy đường tắt tới nhà bà trước.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'flower', x: 60, y: 96, s: 1.3 },
            { k: 'wolf', x: 130, y: 100, s: 1.6, tap: 'spin' },
            { k: 'girl', x: 95, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Tới nơi, Sói gõ cửa giả giọng cháu. Bà ngoại mở cửa, hoảng hồn vội nấp vào trong tủ. Sói leo lên giường, trùm chăn kín mít, giả làm bà nằm chờ Khăn đỏ.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'wolf', x: 110, y: 100, s: 1.6, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Khăn đỏ tới nơi, thấy "bà" lạ quá liền hỏi: "Bà ơi, sao tai bà to thế?" — "Để bà nghe cháu rõ hơn." — "Sao mắt bà to thế?" — "Để bà nhìn cháu rõ hơn." — "Sao mồm bà to thế?". Sói nhe răng gầm lên: "Để ta ăn thịt ngươi đây!"',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'wolf', x: 80, y: 100, s: 1.7, tap: 'spin' },
            { k: 'girl', x: 130, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Khăn đỏ hét toáng lên. Vừa lúc đó, một bác thợ săn đi ngang nghe tiếng kêu liền lao vào. Bác giương súng quát lớn. Sói sợ hãi, vắt chân lên cổ chạy thẳng một mạch vào rừng sâu, không dám quay lại.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'man', x: 70, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'wolf', x: 130, y: 100, s: 1.5, tap: 'spin' },
            { k: 'girl', x: 105, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Bà ngoại từ trong tủ bước ra, ôm chầm lấy cháu. Hai bà cháu cảm ơn bác thợ săn rối rít, rồi cùng nhau ngồi ăn bánh thật vui vẻ.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'oldWoman', x: 80, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'girl', x: 115, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Từ đó, Cô bé quàng khăn đỏ luôn nhớ lời mẹ dặn: đi đường phải đi cho thẳng, tuyệt đối không la cà và không tin lời người lạ.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'woman', x: 80, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'girl', x: 115, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'ba-chu-heo',
    title: 'Ba chú heo con',
    emoji: '🐷',
    moral: 'Làm việc gì cũng phải chăm chỉ và cẩn thận.',
    pages: [
      {
        text: 'Ngày xửa ngày xưa, ở một khu rừng nọ, có ba chú heo con sống cùng mẹ. Một hôm, heo mẹ dặn: "Các con đã lớn rồi, hãy tự xây cho mình một ngôi nhà thật chắc chắn nhé."',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 45, y: 96, s: 1.2 },
            { k: 'pig', x: 90, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'pig', x: 120, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'pig', x: 150, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Chú heo thứ nhất lười nhất, quơ vội ít rơm rạ dựng đại một căn nhà rơm, xong là chạy đi chơi ngay.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 130, y: 96, s: 0.8 },
            { k: 'pig', x: 80, y: 100, s: 1.5, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Chú heo thứ hai nhanh nhảu hơn một chút, chặt mấy cành cây ghép thành một căn nhà gỗ tạm bợ, rồi cũng vội đi chơi.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 130, y: 96, s: 0.85 },
            { k: 'pig', x: 80, y: 100, s: 1.5, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Riêng chú heo thứ ba chăm chỉ và cẩn thận. Chú cặm cụi nhào đất, nung gạch, xây một ngôi nhà gạch thật vững chãi, dù mệt cũng không chịu bỏ dở.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 130, y: 96, s: 1 },
            { k: 'pig', x: 80, y: 100, s: 1.5, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Một hôm, con Sói đói bụng mò tới. Thấy nhà rơm, Sói nhe nanh: "Ta sẽ thổi bay nhà ngươi!". Sói hít một hơi thật sâu, "Phù… ù… ù…" — căn nhà rơm bay tung. Heo con hoảng hốt chạy sang nhà heo thứ hai.',
        scene: {
          bg: 'day',
          items: [
            { k: 'wolf', x: 70, y: 100, s: 1.7, tap: 'spin' },
            { k: 'pig', x: 130, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Sói đuổi theo, tới nhà gỗ lại gầm lên: "Phù… ù… ù…!". Nhà gỗ rung rinh rồi đổ rầm. Hai chú heo con sợ quá, ù té chạy sang nhà gạch của heo thứ ba.',
        scene: {
          bg: 'day',
          items: [
            { k: 'wolf', x: 70, y: 100, s: 1.7, tap: 'spin' },
            { k: 'pig', x: 120, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'pig', x: 148, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Tới nhà gạch, Sói phồng má thổi mãi, thổi mãi đến đỏ cả mặt, mệt bở hơi tai mà ngôi nhà vẫn trơ trơ, không hề suy chuyển.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 130, y: 96, s: 1 },
            { k: 'wolf', x: 75, y: 100, s: 1.6, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Tức tối, Sói leo lên mái, chui xuống ống khói định bắt heo. Nào ngờ ba anh em heo đã nhanh trí nhóm sẵn nồi nước nóng dưới bếp. Sói tụt xuống, bị nóng giãy nảy, kêu oai oái rồi ba chân bốn cẳng bỏ chạy thẳng về rừng sâu, không dám quay lại.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 110, y: 96, s: 1 },
            { k: 'wolf', x: 150, y: 100, s: 1.5, tap: 'spin' },
          ],
        },
      },
      {
        text: 'Từ đó, ba chú heo con sống bình yên trong ngôi nhà gạch chắc chắn. Hai chú heo lười thấm thía: làm việc gì cũng phải chăm chỉ, cẩn thận thì mới bền vững.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 140, y: 96, s: 1 },
            { k: 'pig', x: 70, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'pig', x: 98, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'pig', x: 124, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'soi-bay-de',
    title: 'Sói và bảy chú dê con',
    emoji: '🐐',
    moral: 'Phải nghe lời cha mẹ và cảnh giác với kẻ lạ.',
    pages: [
      {
        text: 'Ngày xửa ngày xưa, ở một ngôi nhà nhỏ ven rừng, có Dê mẹ và bảy chú dê con xinh xắn. Một hôm, Dê mẹ phải vào rừng kiếm cỏ.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'goat', x: 80, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'goat', x: 115, y: 100, s: 1.2, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Trước khi đi, Dê mẹ dặn kỹ: "Các con ở nhà đóng chặt cửa. Có con Sói hay rình mò đấy. Nó giọng thì ồ ề, chân thì đen sì. Tuyệt đối đừng mở cửa cho ai lạ, nghe chưa!". Bảy chú dê dạ ran.',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'goat', x: 90, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'goat', x: 120, y: 100, s: 1.1, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Dê mẹ vừa đi khỏi, Sói đã mò tới gõ cửa, ồm ồm: "Các con ơi, mẹ về rồi, mở cửa cho mẹ!". Đàn dê nghe giọng khàn ồ ề liền đáp: "Mẹ chúng tôi giọng trong veo cơ. Ngươi là Sói, không mở đâu!"',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'wolf', x: 90, y: 100, s: 1.7, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Sói tức lắm, bèn ăn một cục phấn cho giọng thanh hơn, rồi lại gõ cửa giả giọng Dê mẹ. Lũ dê ngó qua khe cửa, thấy bàn chân đen sì liền hô: "Chân mẹ trắng tinh, còn chân ngươi đen thui. Đi đi, đồ Sói gian ác!"',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'wolf', x: 90, y: 100, s: 1.7, tap: 'spin' },
          ],
        },
      },
      {
        text: 'Sói xảo quyệt nhúng chân vào bột mì cho thật trắng, rồi gõ cửa lần nữa. Lần này, đàn dê tưởng thật, mở toang cửa ra. Sói nhe nanh xông vào: "Ha ha! Trúng kế ta rồi!"',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'wolf', x: 80, y: 100, s: 1.8, tap: 'spin' },
            { k: 'goat', x: 130, y: 100, s: 1.2, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Bảy chú dê hốt hoảng chạy tán loạn đi trốn: con nấp gầm bàn, con chui vào tủ, con núp sau cánh cửa, chú dê út bé nhất thì nhảy tọt vào trong chiếc đồng hồ. Sói lục tung cả nhà mà chẳng bắt được con nào, mệt quá nằm vật ra gốc cây ngoài vườn ngủ.',
        scene: {
          bg: 'indoor',
          items: [
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'wolf', x: 120, y: 100, s: 1.6, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Dê mẹ về, gọi mãi không thấy con nào thưa thì hoảng hồn. Bỗng chú dê út trong đồng hồ kêu lên: "Mẹ ơi, con đây! Các anh trốn hết rồi, còn con Sói đang ngủ ngoài vườn kia kìa!"',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 60, y: 96, s: 0.9 },
            { k: 'goat', x: 100, y: 100, s: 1.5, tap: 'wobble' },
            { k: 'wolf', x: 150, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Dê mẹ gọi các con ra. Mấy mẹ con bàn nhau, lén buộc một bao đá nặng lên lưng Sói khi nó còn ngủ say. Sói tỉnh dậy, thấy nặng trĩu, lảo đảo bước ra giếng thì trượt chân ngã tòm xuống, vùng vẫy mãi mới leo lên được, ướt như chuột lột rồi cong đuôi chạy thẳng vào rừng.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'tree', x: 50, y: 96, s: 1.2 },
            { k: 'wolf', x: 120, y: 100, s: 1.5, tap: 'spin' },
          ],
        },
      },
      {
        text: 'Từ đó, Sói không bao giờ dám bén mảng tới nữa. Mấy mẹ con dê ôm nhau mừng mừng tủi tủi. Câu chuyện nhắc các bé: phải luôn nghe lời cha mẹ và cảnh giác với kẻ lạ.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'house', x: 150, y: 96, s: 0.9 },
            { k: 'goat', x: 80, y: 100, s: 1.5, tap: 'bounce' },
            { k: 'goat', x: 115, y: 100, s: 1.2, tap: 'bounce' },
          ],
        },
      },
    ],
  },
  {
    id: 'chu-be-chan-cuu',
    title: 'Cậu bé chăn cừu',
    emoji: '🐑',
    moral: 'Nói dối nhiều lần thì nói thật cũng chẳng ai tin.',
    pages: [
      {
        text: 'Ngày xửa ngày xưa, ở một làng quê nọ, có một cậu bé được giao việc chăn đàn cừu trên đồi cỏ xanh mỗi ngày.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'hill', x: 150, y: 96 },
            { k: 'sheep', x: 70, y: 100, s: 1.4, tap: 'bounce' },
            { k: 'boy', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
      {
        text: 'Ngồi một mình trên đồi mãi cũng buồn, cậu nghĩ ra một trò nghịch. Cậu hớt hải chạy về làng, kêu toáng lên: "Sói! Sói! Có sói ăn cừu! Bà con ơi, cứu với!"',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'boy', x: 90, y: 100, s: 1.4, tap: 'spin' },
          ],
        },
      },
      {
        text: 'Dân làng đang làm việc, nghe vậy vội vứt hết, vác gậy chạy ào lên đồi. Nhưng lên tới nơi chỉ thấy đàn cừu gặm cỏ bình yên. Cậu bé ôm bụng cười nắc nẻ: "Ha ha, cháu nói đùa đấy!"',
        scene: {
          bg: 'day',
          items: [
            { k: 'hill', x: 150, y: 96 },
            { k: 'sheep', x: 60, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'boy', x: 100, y: 100, s: 1.4, tap: 'wobble' },
            { k: 'man', x: 135, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Mọi người bực mình bỏ về. Ít hôm sau, buồn chán, cậu lại giở trò cũ: "Sói! Sói thật rồi! Cứu cháu với!". Dân làng lại tất tả chạy lên, lại bị lừa. Lần này ai cũng giận lắm.',
        scene: {
          bg: 'day',
          items: [
            { k: 'hill', x: 150, y: 96 },
            { k: 'boy', x: 90, y: 100, s: 1.4, tap: 'spin' },
            { k: 'man', x: 130, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Rồi một buổi chiều, con Sói thật từ trong rừng mò ra, lao vào đàn cừu. Cậu bé sợ hãi, gào khản cả cổ: "Sói! Sói thật! Bà con ơi, cứu cháu với!"',
        scene: {
          bg: 'forest',
          items: [
            { k: 'wolf', x: 70, y: 100, s: 1.7, tap: 'spin' },
            { k: 'sheep', x: 110, y: 100, s: 1.3, tap: 'wobble' },
            { k: 'boy', x: 145, y: 100, s: 1.3, tap: 'spin' },
          ],
        },
      },
      {
        text: 'Nhưng lần này, chẳng một ai chạy đến cả. Ai cũng nghĩ: "Hừ, lại cái thằng bé nói dối chứ gì. Không mắc lừa nữa đâu!"',
        scene: {
          bg: 'day',
          items: [
            { k: 'house', x: 150, y: 96, s: 0.85 },
            { k: 'man', x: 90, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Đàn cừu sợ hãi chạy tán loạn khắp đồi. Cậu bé chỉ biết đứng khóc nức nở, ân hận vô cùng vì những lần nói dối trước đây.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'sheep', x: 60, y: 100, s: 1.3, tap: 'spin' },
            { k: 'boy', x: 120, y: 100, s: 1.4, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'May sao, đàn cừu chạy thoát hết vào chuồng, con Sói chẳng bắt được con nào, đành tiu nghỉu lủi về rừng. Nhưng cậu bé thì được một bài học nhớ đời.',
        scene: {
          bg: 'forest',
          items: [
            { k: 'wolf', x: 110, y: 100, s: 1.5, tap: 'spin' },
            { k: 'boy', x: 70, y: 100, s: 1.3, tap: 'wobble' },
          ],
        },
      },
      {
        text: 'Từ đó, cậu bé không bao giờ dám nói dối nữa. Câu chuyện nhắc các bé: nói dối nhiều lần thì đến khi nói thật cũng chẳng còn ai tin mình.',
        scene: {
          bg: 'day',
          items: [
            { k: 'sun', x: 30, y: 28 },
            { k: 'hill', x: 150, y: 96 },
            { k: 'sheep', x: 70, y: 100, s: 1.3, tap: 'bounce' },
            { k: 'boy', x: 120, y: 100, s: 1.3, tap: 'bounce' },
          ],
        },
      },
    ],
  },
];

export const getStory = (id: string) => STORIES.find((s) => s.id === id);
