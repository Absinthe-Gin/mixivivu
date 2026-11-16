/**
 * How-to entries describing this site's actual UI flows. Searched by the
 * chatbot's `search_help` tool together with FAQ and policy pages.
 */
export const SITE_GUIDE: { title: string; link: string; text: string }[] = [
  {
    title: 'Tìm du thuyền',
    link: '/tim-du-thuyen',
    text:
      'Vào "Tìm du thuyền" trên thanh menu hoặc ô tìm kiếm ở trang chủ. Nhập tên du thuyền, chọn địa điểm (Vịnh Hạ Long, Vịnh Lan Hạ, Đảo Cát Bà) và mức giá (1-3 triệu, 3-6 triệu, trên 6 triệu), rồi bấm "Tìm kiếm". Ở trang kết quả có thể lọc theo xếp hạng sao (3, 4, 5 sao) và tiện ích (bể sục, quầy bar, bể bơi...), sắp xếp giá thấp đến cao hoặc cao đến thấp, và chuyển trang ở cuối danh sách. Bấm "Đặt lại" để xoá bộ lọc.',
  },
  {
    title: 'Đặt phòng du thuyền',
    link: '/tim-du-thuyen',
    text:
      'Mở trang chi tiết du thuyền, kéo tới mục "Các loại phòng & giá". Bấm dấu + để chọn số phòng mỗi loại (bấm tên phòng để xem ảnh, diện tích, số khách tối đa và tiện ích). "Tổng tiền" cập nhật theo lựa chọn. Bấm "Đặt ngay", điền ngày nhận phòng, số người lớn/trẻ em, họ tên, số điện thoại, email và yêu cầu (nếu có), rồi bấm "Đặt ngay" để gửi hoặc "Đăng ký tư vấn" để nhân viên gọi lại. Muốn thuê cả tàu cho đoàn, bấm "Thuê trọn tàu". Nhân viên Mixivivu sẽ liên hệ để xác nhận và hướng dẫn thanh toán.',
  },
  {
    title: 'Tìm và đặt khách sạn',
    link: '/khach-san',
    text:
      'Vào "Tìm khách sạn" trên menu. Nhập tên khách sạn, chọn thành phố và mức giá rồi bấm "Tìm kiếm". Lọc theo hạng sao và tiện ích (bể bơi ngoài trời, nhà hàng, wifi miễn phí, lễ tân 24h, phòng có bồn tắm, ban công/cửa sổ). Trên trang chi tiết khách sạn, chọn số phòng ở mục "Các loại phòng & giá" và bấm "Đặt ngay" để gửi yêu cầu đặt phòng.',
  },
  {
    title: 'Tìm vé máy bay',
    link: '/tim-ve-may-bay',
    text:
      'Vào "Tìm vé máy bay". Chọn "Một chiều" hoặc "Khứ hồi", nhập điểm đi, điểm đến, ngày đi (và ngày về nếu khứ hồi), số người lớn, trẻ em, em bé rồi bấm "Tìm chuyến bay". Tick "Vé rẻ nhất tháng" để xem giá rẻ nhất trong tháng. Giá vé được báo trực tiếp qua hotline 0922222016.',
  },
  {
    title: 'Gửi đánh giá',
    link: '/tim-du-thuyen',
    text:
      'Ở cuối trang chi tiết du thuyền hoặc khách sạn, mục "Đánh giá": chọn số sao ở "Chất lượng", nhập họ tên, số điện thoại, email và nội dung, rồi bấm "Gửi". Có thể tìm trong các đánh giá cũ bằng ô "Tìm đánh giá".',
  },
  {
    title: 'Liên hệ Mixivivu',
    link: '/lien-he',
    text:
      'Hotline 0922222016, email info@mixivivu.com. Văn phòng: Tầng 7, số nhà 25, ngõ 38 phố Yên Lãng, phường Láng Hạ, quận Đống Đa, Hà Nội. Có thể gửi yêu cầu qua trang "Liên hệ" (họ tên, email, số điện thoại, nội dung). Giờ làm việc: 9h00-17h30 thứ 2 đến thứ 6, 9h00-12h00 thứ 7.',
  },
  {
    title: 'Tour doanh nghiệp',
    link: '/doanh-nghiep',
    text:
      'Trang "Doanh nghiệp" dành cho công ty muốn tổ chức du lịch tri ân, hội thảo hoặc gặp đối tác trên du thuyền Hạ Long: lịch trình theo yêu cầu, tư vấn chọn du thuyền theo số phòng, boong tàu và ngân sách, thời gian linh hoạt. Bấm "Liên hệ với Mixivivu" để được tư vấn.',
  },
];
