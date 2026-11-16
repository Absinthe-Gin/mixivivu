# Website inventory — mixivivu.com

Survey date: 2026-11-16. Source: https://mixivivu.com (Next.js 13 pages router, build `C4BrEM6vLgq7bPJt2ieBe`).

Route discovery sources: header nav, footer, in-page links, `_buildManifest.js`
(full page list), and the public JSON endpoints called by each page.
`sitemap.xml` and `robots.txt` return the Next.js 404 page.

Reference screenshots: `docs/reference/desktop` (1440px, scaled to 960px),
`docs/reference/mobile` (390px) and `docs/reference/interactions`.

## Public routes

| Route | Page | Type | Layout | Main components | States observed | Surveyed | Clone status |
|---|---|---|---|---|---|---|---|
| `/` | Trang chủ du thuyền | Landing | Main (home header without border) | Video hero, SearchBox, ProductCard grid (6), ReviewQuote tabs, CategoryCard (3), partner logos (14), BlogCard (3), Footer | dropdown open, search suggestion | Yes | Done |
| `/tim-du-thuyen` | Tìm du thuyền | Listing | Main + section background | SearchBox, result count, sort dropdown, filter sidebar (stars, 30 amenities), ProductCard list, Pagination | sort open, filter applied, pagination, empty | Yes | Done |
| `/du-thuyen/:slug` (95) | Chi tiết du thuyền | Detail | Main | Title + price, rating/address badges, image carousel + thumbs, sticky tabs, highlights, info card, room picker, Editor.js content, rules/FAQ links, map/schedule alert, review stats/list/search, review form, booking modals | room modal, booking modal, rent-ship modal, validation | Yes (1 in depth, all via API) | Done |
| `/khach-san` | Trang chủ khách sạn | Landing | Main | Video hero, SearchBoxHotel, hotel card grid (6), reviews (7), Footer | | Yes | Done |
| `/tim-khach-san` | Tìm khách sạn | Listing | Main | SearchBoxHotel, sort, filter (stars 3–5, 6 amenities), hotel list card, pagination | | Yes | Done |
| `/tim-khach-san/:slug` (237) | Chi tiết khách sạn | Detail | Main + breadcrumb | Breadcrumb, title + sale price, carousel, tabs, amenities, info card, rooms, content, reviews | | Yes (1 in depth) | Done |
| `/tim-ve-may-bay` | Tìm vé máy bay | Landing + form | Main | Video hero, flight search form (one-way/round trip, airports, dates, passengers), reviews (6), airline logos (15) | validation on empty search | Yes | Done (search form local only) |
| `/tim-ve-may-bay/ket-qua` | Kết quả vé máy bay | Results | Main | Needs live fare API | — | No (needs live fare backend) | Placeholder page with search summary |
| `/tim-ve-may-bay/ve-re-nhat-thang` | Vé rẻ nhất tháng | Results | Main | Needs live fare API | — | No | Placeholder page |
| `/doanh-nghiep` | Doanh nghiệp | Landing | Main + section bg | SearchBox, intro + CTA, 3 business cards, customer reviews | | Yes | Done |
| `/blog` | Blog | Listing | Main | SectionHeader, tabs (Tất cả/Du lịch/Khách sạn/Du thuyền), BlogCard grid, pagination | tab change | Yes | Done |
| `/blog-detail/:slug` (131) | Chi tiết blog | Detail | Main | Title, date badge, intro, cover image, Editor.js content | | Yes | Done |
| `/ve-chung-toi` | Về chúng tôi | Content | Main | Sections 1–5, 4 feature cards, partner cards | | Yes | Done |
| `/lien-he` | Liên hệ | Form | Main | Google Map embed, contact form with validation | validation errors | Yes | Done |
| `/cau-hoi-thuong-gap` | FAQ du thuyền | Content | Main | Accordion (12) | open/closed | Yes | Done |
| `/khach-san/cau-hoi-thuong-gap` | FAQ khách sạn | Content | Main | Accordion (8) | | Yes | Done |
| `/quy-dinh-chung-va-luu-y` | Quy định du thuyền | Content | Main | Rich text | | Yes | Done |
| `/khach-san/quy-dinh-chung-va-luu-y` | Quy định khách sạn | Content | Main | Rich text | | Yes | Done |
| `/dieu-khoan-va-dieu-kien` | Điều khoản | Content | Main | Rich text | | Yes | Done |
| `/chinh-sach-rieng-tu` | Chính sách riêng tư | Content | Main | Rich text | | Yes | Done |
| `/huong-dan-su-dung` | Hướng dẫn sử dụng | Content | Main | Rich text | | Yes | Done |
| `/hinh-thuc-thanh-toan` | Hình thức thanh toán | Content | Main | Rich text + image | | Yes | Done |
| `*` | 404 | Error | Main | Not-found message | | Yes (`/robots.txt`) | Done |

### Excluded routes

`/admin/**` (17 pages) and `/api/images/upload` require an authenticated
staff account. They were not accessed and are out of scope.

## Shared layout

- **Header** (sticky, 96px, white, bottom border `gray-200`; no border on home pages):
  logo 156×42, nav (Tìm du thuyền, Tìm vé máy bay, Tìm khách sạn → `/khach-san`, Doanh nghiệp, Blog),
  active item `primary-dark` text + 2px `primary-base` underline, hotline, "Liên hệ Mixivivu" button.
  ≤1024px: nav and hotline hidden, logo 120×30, menu button opens full-width drop-down list.
- **Footer**: dark block (`gray-900`) with logo, company info, three link columns; bottom bar (`gray-800`) with copyright.
- **SectionHeader**: h4 title + decorative `heading-border.png` (80×8) + optional description (488px) on the right.
- **Section background**: `section-background.png` contour-line pattern, repeated.

## Design tokens (from production CSS)

- Font: Archivo (400/500/600/700).
- Colors: primary light `#caf8f8`, base `#77dada`, dark `#0e4f4f`; gray 50–900 (`#f9fafb` … `#101828`);
  success/error/warning/information light/base/dark.
- Headings: h1 80/90, h2 60/72, h3 48/60, h4 36/44, h5 30/38, h6 24/32 (all 700).
  Body: p.xl 20/30, p.lg 18/28, p.md 16/24 (gray-600), p.sm 14/20. Labels 500 weight.
- Container: max 1280px with 8px padding (content width 1216px).
- Radius: cards 32px, card images 24px, inputs 28px, buttons pill (100px), room thumb 12px.
- Shadows: xs `0 1px 2px #1018280d`; sm `0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)`;
  image `0 4px 6px -2px rgba(16,24,40,.06), 0 12px 16px -4px rgba(16,24,40,.1)`.
- Breakpoints used: 1280, 1200, 1024 (main), 480, 400.

## Interactions recorded

| Trigger | Before | After | Data |
|---|---|---|---|
| Click "Tất cả địa điểm" | closed | list: Tất cả địa điểm, Vịnh Hạ Long, Vịnh Lan Hạ, Đảo Cát Bà | categories |
| Click "Tất cả mức giá" | closed | list: Tất cả, 1–3 triệu, 3–6 triệu, Trên 6 triệu | price ranges |
| Type ship name + Tìm kiếm | home | `/tim-du-thuyen?title=…&category=…&greater_defaultPrice=…&lower_defaultPrice=…` | ships |
| Click reviewer tab | one quote | selected reviewer quote | static reviews |
| Sort dropdown | "Không sắp xếp" | Không sắp xếp / Giá thấp đến cao / Giá cao đến thấp | |
| Check "5 sao" | 95 results | 45 results (rating floor = 5) | |
| Pagination | page 1 (5 per page) | page n | |
| Room title click | list | modal: gallery, size, max persons, room amenities, quantity stepper, "Chọn phòng" | rooms |
| Room +/- | 0 | count, "Tổng tiền" updates | |
| "Đặt ngay" (detail) | | modal "Đặt du thuyền": date, guests, name/phone/email (required), note, total | |
| "Thuê trọn tàu" | | modal "Thuê trọn tàu": same form without total | |
| Contact submit empty | | errors: "Bạn phải nhập họ và tên", "Bạn phải nhập email", "Bạn phải nhập số điện thoại", "Bạn cần nhập nội dung yêu cầu" | |
| FAQ header click | open | collapsed | |
| Blog tab | Tất cả | filtered by blog type | blogs |

## Data sources

Public JSON endpoints (no auth): `/api/products/get-list`, `/api/hotels/get-list`,
`/api/blogs/get-list`, `/api/categories/get-list`, `/api/features/get-list`,
`/api/features-hotel/get-list`, `/api/cities/get-list`, `/api/reviews-v2/get-list`.
Static texts (home reviews, business cards, price ranges, nav) come from the JS bundle;
legal pages and FAQs from the rendered DOM.

The reviews endpoint also returns reviewer phone numbers and e-mail addresses. These were
dropped at capture time and are not stored in this repository.

## Known differences in the source

- All 95 ships belong to the "Vịnh Hạ Long" category. The source listing ignores the
  `category` query parameter (shows 95 for Lan Hạ). The clone applies the filter, so
  Lan Hạ and Cát Bà show the empty state.
- Hotel reviews endpoint returned no published reviews.
- Hero backgrounds are MP4 videos (≈23 MB each) served from the source CDN; the clone streams them from there and does not commit them.
