import type { BlogType } from '@/types/models';

/** Static copy and option lists taken from the source pages/bundle. */

export interface PriceRange {
  label: string;
  min?: number;
  max?: number;
}

export const PRICE_RANGES: PriceRange[] = [
  { label: 'Tất cả mức giá' },
  { label: 'Từ 1 đến 3 triệu', min: 1_000_000, max: 3_000_000 },
  { label: 'Từ 3 đến 6 triệu', min: 3_000_000, max: 6_000_000 },
  { label: 'Trên 6 triệu', min: 6_000_000 },
];

export type SortOrder = '' | 'ASC' | 'DESC';
export const SORT_OPTIONS: { label: string; value: SortOrder }[] = [
  { label: 'Không sắp xếp', value: '' },
  { label: 'Giá thấp đến cao', value: 'ASC' },
  { label: 'Giá cao đến thấp', value: 'DESC' },
];

export const STAR_OPTIONS = [3, 4, 5];

export const BLOG_TABS: { value: 'all' | BlogType; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'travel', label: 'Du lịch' },
  { value: 'hotel', label: 'Khách sạn' },
  { value: 'ship', label: 'Du thuyền' },
];

export const SHIP_PARTNERS = Array.from({ length: 14 }, (_, i) => `assets/partners/partner${i + 1}.png`);
export const FLIGHT_PARTNERS = Array.from({ length: 15 }, (_, i) => `assets/flight-partners/flight-partner-${i}.png`);

export const HOME_COPY = {
  ship: {
    searchTitle: 'Bạn lựa chọn du thuyền Hạ Long nào?',
    searchDescription: 'Hơn 100 tour du thuyền hạng sang giá tốt đang chờ bạn',
    popularTitle: 'Du thuyền mới\nvà phổ biến nhất',
    popularDescription:
      'Tận hưởng sự xa hoa và đẳng cấp tối đa trên du thuyền mới nhất và phổ biến nhất. Khám phá một hành trình tuyệt vời đưa bạn vào thế giới của sự sang trọng, tiện nghi và trải nghiệm không thể quên.',
    viewAll: 'Xem tất cả Du thuyền',
    reviewsTitle: 'Đánh giá từ những\nngười đã trải nghiệm',
    reviewsDescription: 'Khách hàng chia sẻ về những kỷ niệm tuyệt vời trên chuyến du lịch với chúng tôi.',
    destinationsTitle: 'Các điểm đến của Mixivivu',
    destinationsDescription: 'Khám phá vẻ đẹp tuyệt vời của Du thuyền Hạ Long: Hành trình đến thiên đường thiên nhiên',
    partnersTitle: 'Đối tác Cùng các\nHãng Du thuyền Lớn',
    partnersDescription: 'Đối tác hàng đầu với các hãng du thuyền danh tiếng: Ưu đãi độc quyền dành riêng cho bạn',
  },
  hotel: {
    searchTitle: 'Bạn lựa chọn khách sạn nào?',
    searchDescription: 'Hàng nghìn khách sạn với mức giá tốt nhất đang chờ bạn',
    listingSearchDescription: 'Hơn 100 khách sạn hạng sang giá tốt đang chờ bạn',
    popularTitle: 'Khám phá và trải nghiệm\ntất cả dịch vụ tuyệt vời nhất\ntừ các khách sạn trên mọi miền\nđất nước cùng Mixi Vivu.',
    popularDescription:
      'Không gian nghỉ dưỡng sang trọng, tiện nghi và hiện đại cùng dịch vụ chuyên nghiệp, Mixi Vivu tự hào mang đến những trải nghiệm hoàn hảo cho kỳ nghỉ của bạn, giúp bạn tận hưởng từng khoảnh khắc một cách đáng nhớ và trọn vẹn nhất!',
    viewAll: 'Xem tất cả Khách sạn',
    destinationsDescription: 'Trải nghiệm sự sang trọng và thư giãn tại Khách sạn: Hành trình đến thiên đường nghỉ dưỡng hoàn hảo',
    partnersTitle: 'Đối tác Cùng các\nKhách Sạn Lớn',
    partnersDescription: 'Đối tác hàng đầu với các khách sạn danh tiếng: Ưu đãi độc quyền dành riêng cho bạn',
    blogTitle: 'Khám phá Sự đặc sắc\nvà Cập nhật tin tức mới nhất',
    blogDescription: 'Những điểm đến hấp dẫn cùng nhiều thông tin cần thiết cho chuyến du lịch tuyệt vời của bạn.',
    /** Cities featured on /khach-san (ids and images from the source page data). */
    destinations: [
      { id: '66717f39b341a1ec8fb623c1', name: 'Ninh Bình', image: 'hotel/location/hotel/st0yrxsvr338xn91.webp' },
      { id: '66717f39b341a1ec8fb623d9', name: 'Đà Nẵng', image: 'hotel/location/hotel/2johsh9rc8z1p9f1.webp' },
      { id: '66deddf173736d745577a352', name: 'Nha Trang', image: 'tour/location/images/m24xg4lftaykx77i.webp' },
      { id: '66df14ae73736d745577a916', name: 'Phú Quốc', image: 'hotel/location/hotel/kb00x3gqu3jvg574.webp' },
      { id: '66fe61bf0b818e5ee74ce9df', name: 'Hạ Long', image: 'hotel/location/hotel/qon6fo1lgky50tcy.webp' },
    ],
  },
  blog: {
    title: 'Hạ Long: Khám phá Sự đặc sắc\nvà Cập nhật tin tức mới nhất',
    description: 'Hạ Long: Bí mật và Cuộc sống trong Vịnh - Khám phá và Cập nhật những tin tức hấp dẫn từ điểm đến tuyệt vời này.',
  },
  flight: {
    title: 'Mở cánh cửa khám phá cùng Mixivivu',
    description: 'Mixivivu - Đặt chân lên đỉnh mây với một bước nhảy',
    partnersTitle: 'Đối tác Cùng các\nHãng máy bay lớn',
    partnersDescription: 'Đối tác hàng đầu với các hãng máy bay lớn: Ưu đãi độc quyền dành riêng cho bạn',
  },
};

export const BUSINESS = {
  searchDescription: 'Hơn 100 tour du thuyền sang trọng, đẳng cấp 5 sao thăm vịnh Hạ Long và vịnh Lan Hạ đang chờ đón bạn.',
  title: 'Mixivivu - Tour Du thuyền Hạ Long: Kết nối doanh nghiệp, khám phá vẻ đẹp tự nhiên',
  description:
    'Với sự trải nghiệm thực tế, Công ty TNHH Du lịch và Dịch vụ MixiVivu mong muốn đưa du thuyền Hạ Long trở thành một lựa chọn đầu tiên cho doanh nghiệp. Nhiều chương trình du lịch hấp dẫn, đa dạng được kết hợp sẽ đem đến cho quý doanh nghiệp sự hài lòng và thuận tiện. Du thuyền Hạ Long cũng sẽ là một món quà tri ân vô cùng ý nghĩa dành cho nhân viên của quý doanh nghiệp. Bên cạnh đó, du thuyền Hạ Long còn rất phù hợp cho những cuộc hội thảo, hợp tác đầu tư hay giao lưu của quý doanh nghiệp.',
  cards: [
    {
      img: 'assets/business/business1.png',
      title: 'Lịch trình phù hợp với yêu cầu của doanh nghiệp',
      content:
        'Du thuyền sẽ sắp xếp lịch trình phù hợp với từng sự kiện của doanh nghiệp: du lịch của công ty tri ân nhân viên, hội thảo hay làm việc với đối tác',
    },
    {
      img: 'assets/business/business2.png',
      title: 'Đa dạng trong sự lựa chọn các du thuyền',
      content:
        'Tùy vào nhu cầu của doanh nghiệp, chúng tôi sẽ tư vấn cung cấp du thuyền phù hợp về: số lượng phòng nghỉ, boong tàu rộng rãi hay chi phí hợp lý.',
    },
    {
      img: 'assets/business/business3.png',
      title: 'Thời gian linh hoạt',
      content:
        'Chúng tôi sẽ tư vấn thời gian linh hoạt nhất phù hợp với tính chất của sự kiện và lịch làm việc trước và sau chuyến đi của quý doanh nghiệp.',
    },
  ],
  customersTitle: 'Khách hàng của Mixivivu',
  customersDescription: 'Mixivivu mang đến một trải nghiệm hoàn toàn mới, trải nghiệm đẳng cấp 5 sao cho khách hàng',
};

export const CONTACT_COPY = {
  title: 'Khám phá Hạ Long thông qua Du thuyền',
  description: 'Khám phá Hạ Long qua Du thuyền cùng Mixivivu - Hãy liên hệ ngay để trải nghiệm hành trình tuyệt vời!',
};
