/** Airports offered by the flight search box (domestic + common international). */
export interface Airport {
  code: string;
  city: string;
  name: string;
}

export const AIRPORTS: Airport[] = [
  { code: 'HAN', city: 'Hà Nội', name: 'Sân bay Nội Bài' },
  { code: 'SGN', city: 'Hồ Chí Minh', name: 'Sân bay Tân Sơn Nhất' },
  { code: 'DAD', city: 'Đà Nẵng', name: 'Sân bay Đà Nẵng' },
  { code: 'PQC', city: 'Phú Quốc', name: 'Sân bay Phú Quốc' },
  { code: 'CXR', city: 'Nha Trang', name: 'Sân bay Cam Ranh' },
  { code: 'HPH', city: 'Hải Phòng', name: 'Sân bay Cát Bi' },
  { code: 'VDO', city: 'Quảng Ninh', name: 'Sân bay Vân Đồn' },
  { code: 'HUI', city: 'Huế', name: 'Sân bay Phú Bài' },
  { code: 'DLI', city: 'Đà Lạt', name: 'Sân bay Liên Khương' },
  { code: 'UIH', city: 'Quy Nhơn', name: 'Sân bay Phù Cát' },
  { code: 'VCA', city: 'Cần Thơ', name: 'Sân bay Cần Thơ' },
  { code: 'VII', city: 'Vinh', name: 'Sân bay Vinh' },
  { code: 'THD', city: 'Thanh Hóa', name: 'Sân bay Thọ Xuân' },
  { code: 'BMV', city: 'Buôn Ma Thuột', name: 'Sân bay Buôn Ma Thuột' },
  { code: 'VCS', city: 'Côn Đảo', name: 'Sân bay Côn Đảo' },
  { code: 'BKK', city: 'Bangkok', name: 'Sân bay Suvarnabhumi' },
  { code: 'SIN', city: 'Singapore', name: 'Sân bay Changi' },
  { code: 'ICN', city: 'Seoul', name: 'Sân bay Incheon' },
  { code: 'NRT', city: 'Tokyo', name: 'Sân bay Narita' },
  { code: 'TPE', city: 'Đài Bắc', name: 'Sân bay Đào Viên' },
];

export const airportLabel = (a: Airport) => `${a.city} (${a.code})`;
