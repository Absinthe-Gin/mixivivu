import { ROUTES } from '@/constants/routes';

/** Central business configuration (contact info, CDN, nav, footer). */
export const SITE = {
  name: 'Mixivivu',
  hotline: '0922222016',
  email: 'info@mixivivu.com',
  company: 'Công ty TNHH Du Lịch và Dịch Vụ Mixivivu',
  address: 'Tầng 7, số nhà 25, ngõ 38 phố Yên Lãng, phường Láng Hạ, quận Đống Đa, TP. Hà Nội',
  businessLicense: 'Mã số doanh nghiệp: 0110376372 do Sở Kế hoạch và Đầu tư Thành phố Hà Nội cấp ngày 05/06/2023',
  copyright: 'Bản quyền © 2024 Mixivivu.',
  /** Product images and hero videos stay on the source CDN (not committed). */
  cdnBase: 'https://minio.fares.vn/mixivivu-dev/',
  heroVideos: {
    ship: 'https://minio.fares.vn/mixivivu-dev/video/Mixivivuduthuyen.mp4',
    hotel: 'https://minio.fares.vn/mixivivu-dev/video/MixivivuHotel.mp4',
    flight: 'https://minio.fares.vn/mixivivu-dev/video/Mixivivumaybay.mp4',
  },
  officeMapEmbed:
    'https://maps.google.com/maps?q=25%20ng%C3%B5%2038%20Y%C3%AAn%20L%C3%A3ng%2C%20%C4%90%E1%BB%91ng%20%C4%90a%2C%20H%C3%A0%20N%E1%BB%99i&z=17&output=embed',
} as const;

export interface NavItem {
  label: string;
  to: string;
  /** Extra paths that also mark the item as active. */
  match?: string[];
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Tìm du thuyền', to: ROUTES.shipSearch, match: [ROUTES.shipSearch, '/du-thuyen'] },
  { label: 'Tìm vé máy bay', to: ROUTES.flight, match: [ROUTES.flight] },
  { label: 'Tìm khách sạn', to: ROUTES.hotelHome, match: [ROUTES.hotelHome, ROUTES.hotelSearch] },
  { label: 'Doanh nghiệp', to: ROUTES.business },
  { label: 'Blog', to: ROUTES.blog, match: [ROUTES.blog, '/blog-detail'] },
];

export const FOOTER_COLUMNS: { title: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    title: 'GIỚI THIỆU',
    links: [
      { label: 'Về chúng tôi', to: ROUTES.aboutUs },
      { label: 'Điều khoản và điều kiện', to: ROUTES.terms },
      { label: 'Chính sách riêng tư', to: ROUTES.privacy },
      { label: 'Hướng dẫn sử dụng', to: ROUTES.guide },
      { label: 'Hình thức thanh toán', to: ROUTES.payment },
      { label: 'Liên hệ', to: ROUTES.contact },
      { label: `Hotline: ${SITE.hotline}`, to: `tel:${SITE.hotline}`, external: true },
      { label: `Email: ${SITE.email}`, to: `mailto:${SITE.email}`, external: true },
    ],
  },
  {
    title: 'ĐIỂM ĐẾN',
    links: [
      { label: 'Vịnh Hạ Long', to: `${ROUTES.shipSearch}?category=64c8f53047dcd21cb95abf37` },
      { label: 'Vịnh Lan Hạ', to: `${ROUTES.shipSearch}?category=64c8f531d5aaae789bcf1dfa` },
      { label: 'Đảo Cát Bà', to: `${ROUTES.shipSearch}?category=64c8f53247dcd21cb95abf39` },
    ],
  },
  {
    title: 'DU THUYỀN',
    links: [
      { label: 'Blog', to: ROUTES.blog },
      { label: 'Quy định chung và lưu ý', to: ROUTES.shipRules },
      { label: 'Câu hỏi thường gặp', to: ROUTES.shipFaq },
    ],
  },
];
