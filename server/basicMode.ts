/**
 * Keyword-based answers used when no Claude credentials are configured, so
 * the widget still helps (and can be tested) without an API key.
 */
import { normalize, searchHelp, searchHotels, searchShips } from './catalog.ts';

const NOTE = '\n\n_(Trợ lý đang chạy ở chế độ cơ bản. Gọi hotline **0922222016** để được tư vấn chi tiết.)_';

/** "dưới 4 triệu", "4tr", "3-5 triệu" → VND bounds. */
function priceBounds(q: string): { min?: number; max?: number } {
  const m = q.match(/(\d+(?:[.,]\d+)?)\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*(?:trieu|tr)\b/);
  const toVnd = (s: string) => Math.round(parseFloat(s.replace(',', '.')) * 1_000_000);
  if (m) return { min: toVnd(m[1]), max: toVnd(m[2]) };
  const one = q.match(/(duoi|toi da|khong qua|tren|tu)?\s*(\d+(?:[.,]\d+)?)\s*(?:trieu|tr)\b/);
  if (!one) return {};
  const v = toVnd(one[2]);
  if (one[1] === 'tren' || one[1] === 'tu') return { min: v };
  if (one[1]) return { max: v };
  return { min: Math.round(v * 0.8), max: Math.round(v * 1.2) };
}

const HOTEL_CITIES = ['ha long', 'da nang', 'nha trang', 'phu quoc', 'sapa', 'hoi an', 'da lat', 'quy nhon', 'ninh binh', 'cat ba', 'tam dao', 'vung tau', 'ha noi'];

export function basicAnswer(question: string): string {
  const q = normalize(question);
  const price = priceBounds(q);

  if (/khach san|hotel|resort|phong nghi/.test(q)) {
    const city = HOTEL_CITIES.find((c) => q.includes(c));
    const stars = q.match(/([345])\s*sao/)?.[1];
    const r = searchHotels({ city, min_price: price.min, max_price: price.max, stars: stars ? Number(stars) : undefined, sort: 'price_asc', limit: 4 });
    if (!r.results.length) return `Mình chưa tìm thấy khách sạn phù hợp. Bạn thử xem danh sách tại [Tìm khách sạn](/tim-khach-san).${NOTE}`;
    return (
      `Một số khách sạn phù hợp${city ? ` ở ${r.results[0].city}` : ''} (${r.total} kết quả):\n` +
      r.results.map((h) => `- **[${h.title}](${h.link})** - ${h.stars ?? '?'} sao, từ ${h.price_per_room}/phòng`).join('\n') +
      `\n\nXem thêm tại [Tìm khách sạn](/tim-khach-san).${NOTE}`
    );
  }

  if (/du thuyen|tau|cruise|vinh|ha long|lan ha|cat ba/.test(q) && !/\b(huy|thanh toan|quy dinh|tre em|thu cung|hoan tien)\b/.test(q)) {
    const destination = q.includes('lan ha') ? 'Vịnh Lan Hạ' : q.includes('cat ba') ? 'Đảo Cát Bà' : undefined;
    const amenities = [['be suc', 'bể sục'], ['be boi', 'bể bơi'], ['kayak', 'kayak'], ['spa', 'spa']].filter(([k]) => q.includes(k)).map(([, v]) => v);
    const r = searchShips({ destination, min_price: price.min, max_price: price.max, amenities, sort: 'rating', limit: 4 });
    if (!r.results.length) return `Mình chưa tìm thấy du thuyền phù hợp${r.note ? ` (${r.note})` : ''}. Bạn thử [Tìm du thuyền](/tim-du-thuyen).${NOTE}`;
    return (
      `Gợi ý du thuyền (${r.total} kết quả):\n` +
      r.results.map((s) => `- **[${s.title}](${s.link})** - từ ${s.price_per_guest}/khách, ${s.rating}`).join('\n') +
      `\n\nĐể đặt, mở trang du thuyền, chọn phòng ở mục "Các loại phòng & giá" rồi bấm **Đặt ngay**.${NOTE}`
    );
  }

  if (/may bay|ve bay|chuyen bay|flight/.test(q)) {
    return `Bạn vào [Tìm vé máy bay](/tim-ve-may-bay), chọn điểm đi, điểm đến, ngày bay và số hành khách rồi bấm **Tìm chuyến bay**. Giá vé được báo trực tiếp qua hotline **0922222016**.${NOTE}`;
  }

  const help = searchHelp(question, 2);
  if (help.results.length) {
    return (
      help.results.map((c) => `**${c.source}**\n${c.text.split('\n').slice(0, 6).join('\n')}\n[Xem chi tiết](${c.link})`).join('\n\n') + NOTE
    );
  }
  return `Mình có thể giúp bạn tìm du thuyền, khách sạn hoặc hướng dẫn đặt dịch vụ. Ví dụ: "du thuyền có bể sục dưới 4 triệu" hay "khách sạn 5 sao ở Đà Nẵng".${NOTE}`;
}
