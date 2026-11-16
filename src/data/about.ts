import type { IconName } from '@/components/common/Icon';

/** "Về chúng tôi" page content (captured from the source DOM). */
export const ABOUT = {
  title: 'Về Mixivivu',
  intro: {
    heading: '1. Chúng tôi là Mixi Vivu',
    text: 'Mixivivu.com là sản phẩm chính thức của Công ty TNHH Du lịch và dịch vụ Mixi Vivu. Với niềm đam mê du lịch, ưa khám phá, chúng tôi đã cùng nhau xây dựng một website – nơi mà khách hàng sẽ dễ dàng lựa chọn cho mình cũng như những người thân yêu chuyến nghỉ dưỡng đáng nhớ. Mixi Vivu chọn lọc các du thuyền, khách sạn và liên kết với các hãng hàng không nhằm cung cấp những dịch vụ đa dạng và tốt nhất cho du khách.',
  },
  why: {
    heading: '2. Tại sao chọn chúng tôi?',
    text: 'Chúng tôi mong muốn du khách tận hưởng các dịch vụ du lịch chất lương bằng sự trải nghiệm thực tế của chính đội ngũ của Mixi Vivu. Các video về du thuyền, khách sạn hay những chuyến bay mà chúng tôi đã ghi lại cũng sẽ được chúng tôi giới thiệu tới du khách. Chính từ những hình ảnh này, quý khách có thể chọn lựa cho mình hay gia đình, bạn bè, đồng nghiệp những chuyến đi ý nghĩa nhất. Chúng tôi chắc chắn sẽ mang lại cho du khách những kỳ nghĩ đáng nhớ với:',
    cards: [
      {
        icon: 'diamond' as IconName,
        title: 'Đội ngũ chuyên nghiệp, tâm huyết',
        text: 'Chúng tôi có đội ngũ nhân viên kinh nghiệm, tâm huyết, luôn lắng nghe những thắc mắc, ý kiến của khách hàng thông qua hotline, fanpage được kết nối liên tục. Với vốn kiến thức quý giá tích lũy qua nhiều năm, chúng tôi sẽ tư vấn cho du khách những sản phẩm du lịch phù hợp nhất cũng như những vấn đề phát sinh trong chuyến nghỉ dưỡng. Ngoài ra, chúng tôi còn có những nhân viên mới trẻ trung, năng động hứa hẹn sẽ giới thiệu nhiều điểm đến mới hấp dẫn cho du khách.',
      },
      {
        icon: 'star' as IconName,
        title: 'Sản phẩm phong phú',
        text: 'Tại địa chỉ website: https://mixivivu.com của chúng tôi, du khách có thể dễ dàng tìm thấy một du thuyền sang trọng, một chuyến bay khứ hồi hay một khu nghỉ dưỡng tuyệt đẹp trên mảnh đất hình chữ S. Chúng tôi cũng đưa ra những thông tin đầy đủ, hình ảnh thực tế của các dịch vụ chất lượng. Qua đó, du khách sẽ chon lựa được một dịch vụ phù hợp cho chuyến đi cùng gia đình, bạn bè hay đồng nghiệp.',
      },
      {
        icon: 'coin' as IconName,
        title: 'Mức giá hấp dẫn',
        text: 'Mixi Vivu luôn cam kết sẽ đem đến các dịch vụ chất lượng với các mức giá tốt nhất. Chúng tôi tin chắc rằng chi phí mà quý khách thanh toán là hoàn toàn xứng đáng. Bên cạnh đó, quý khách cũng có thể tìm thấy nhiều món quà hấp dẫn trong những đợt khuyến mại trên website của chúng tôi.',
      },
      {
        icon: 'lock' as IconName,
        title: 'Bảo mật thông tin',
        text: 'Chúng tôi cam kết toàn bộ mọi thông tin cá nhân của khách hàng sẽ được giữ bí mật tuyệt đối. Quý khách có thể yên tâm trải nghiệm dịch vụ thực sự thoải mái và riêng tư. Hi vọng, mixivivu.com sẽ là một địa chỉ tin cậy trong mỗi chuyến đi , mỗi kỳ nghỉ của quý khách.',
      },
    ],
  },
  services: {
    heading: '3. Sản phẩm dịch vụ',
    text: 'Mixi Vivu cung cấp nhiều dịch vụ du lịch phong phú và đa dạng giúp du khách có nhiều lựa chọn:',
    items: [
      'Vé máy bay của các hãng hàng không trong và ngoài nước',
      'Du thuyền Hạ Long với đa dạng du thuyền, phù hợp với từng nhu cầu của du khách',
      'Đặt phòng khách sạn và resort',
    ],
    outro:
      'Ngoài ra, chúng tôi cũng cung cấp nhiều dịch vụ khác như: thuê xe du lịch chất lượng cao, thuê hướng dẫn viên du lịch, visa, vé tàu…giúp du khách thoải mái và dễ dàng cho những chuyến du lịch.',
  },
  partners: {
    heading: '4. Đối tác của chúng tôi',
    text: 'Để xây dựng được hệ thống website nhanh và mạnh nhằm mang lại những dịch vụ tốt nhất cho quý khách, Mixi Vivu xin được gửi lời cảm ơn tới các đối tác đã hỗ trợ và đồng hành cùng chúng tôi:',
    items: [
      {
        logo: 'assets/logos/fares.png',
        url: 'https://fares.vn/',
        role: 'Công nghệ thông tin',
        text: 'FARES., JSC cung cấp các giải pháp toàn diện về chuyển đổi số cho doanh nghiệp: Phát triển phần mềm theo yêu cầu, xây dựng hệ thống thông tin, xử lý và phân tích dữ liệu lớn phục vụ chiến lược Marketing, kinh doanh & quản lý. Với đội ngũ chuyên gia tài năng và kinh nghiệm, FARES., JSC cam kết mang đến những giải pháp đột phá và sáng tạo, giúp khách hàng tận dụng tối đa tiềm năng của công nghệ để nâng cao hiệu suất kinh doanh và đạt được sự cạnh tranh trong môi trường kinh doanh ngày càng phức tạp. FARES., JSC đã hỗ trợ và đồng hành cùng MixiVivu trong việc xây dựng hệ thống website, nhằm mang lại cho khách hàng những thông tin nhanh và tin cậy nhất.',
      },
      {
        logo: 'assets/logos/zestif.png',
        url: 'https://zestif.com/',
        role: 'Tư vấn thiết kế',
        text: 'Zestif là một công ty công nghệ blockchain có trụ sở tại Hà Lan và Hà Nội, Việt Nam. Công ty được thành lập vào năm 2017 với sứ mệnh mang công nghệ blockchain đến với các doanh nghiệp và tổ chức ở Việt Nam và Hà Lan. Zestif cung cấp các dịch vụ tư vấn, đào tạo và phát triển giải pháp blockchain. Công ty đã triển khai thành công nhiều giải pháp blockchain cho các doanh nghiệp và tổ chức ở Hà Lan, Vương quốc Anh và các quốc gia EU khác.',
      },
    ],
  },
  contact: {
    heading: '5. Liên hệ với chúng tôi:',
    company: 'CÔNG TY TNHH DU LỊCH VÀ DỊCH VỤ MIXI VIVU',
    companyEn: 'MIXI VIVU TRAVEL AND SERVICE COMPANY LIMITED',
    legal: ['Mã số thuế: 0110376372', 'Giấy phép kinh doanh số: 0110376372', 'Nơi cấp: Sở KH & ĐT TP Hà Nội.'],
    lines: ['Hà Nội: Số 25 - Ngõ 38 Phố Yên Lãng - Quận Đống Đa - Hà Nội', 'Điện thoại: 0922222016', 'Địa chỉ email: info@mixivivu.com'],
  },
};
