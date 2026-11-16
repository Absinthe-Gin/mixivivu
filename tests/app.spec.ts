import { expect, test, type Page } from '@playwright/test';

const ROUTES = [
  ['', 'Bạn lựa chọn du thuyền Hạ Long nào?'],
  ['tim-du-thuyen', 'Tìm thấy 95 kết quả'],
  ['du-thuyen/president-cruises-halong', 'Du thuyền Ambassador Hạ Long'],
  ['khach-san', 'Bạn lựa chọn khách sạn nào?'],
  ['tim-khach-san', 'Tìm thấy 237 kết quả'],
  ['tim-khach-san/delasea-phat-linh-ha-long', 'DeLaSea Phát Linh Hạ Long'],
  ['tim-ve-may-bay', 'Mở cánh cửa khám phá cùng Mixivivu'],
  ['doanh-nghiep', 'Kết nối doanh nghiệp'],
  ['blog', 'Cập nhật tin tức mới nhất'],
  ['blog-detail/concert-exo-hcm', 'quét sạch'],
  ['ve-chung-toi', 'Về Mixivivu'],
  ['lien-he', 'Khám phá Hạ Long thông qua Du thuyền'],
  ['cau-hoi-thuong-gap', 'Dịch vụ xe đưa đón có bao gồm trong giá tour không?'],
  ['khach-san/cau-hoi-thuong-gap', 'Câu hỏi thường gặp'],
  ['quy-dinh-chung-va-luu-y', 'Quy định chung'],
  ['khach-san/quy-dinh-chung-va-luu-y', 'Quy định'],
  ['dieu-khoan-va-dieu-kien', 'Điều khoản và điều kiện'],
  ['chinh-sach-rieng-tu', 'Chính sách'],
  ['huong-dan-su-dung', 'Hướng dẫn'],
  ['hinh-thuc-thanh-toan', 'Hình thức thanh toán'],
  ['khong-ton-tai', '404'],
] as const;

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Third-party embeds (maps, CDN media) are outside the app.
    if (m.type() === 'error' && !/google|maps|minio|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

for (const [path, text] of ROUTES) {
  test(`route /${path} renders without runtime errors`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('header navigation marks the active route', async ({ page }) => {
  await page.goto('');
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Blog' }).click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.getByRole('link', { name: 'Blog' }).first()).toHaveClass(/text-primary-dark/);
});

test('home search sends title, category and price to the listing', async ({ page }) => {
  await page.goto('');
  await page.getByRole('textbox', { name: 'Nhập tên du thuyền' }).fill('Ambassador');
  await page.getByRole('button', { name: 'Địa điểm' }).click();
  await page.getByRole('option', { name: 'Vịnh Hạ Long' }).click();
  await page.getByRole('button', { name: 'Mức giá' }).click();
  await page.getByRole('option', { name: 'Từ 3 đến 6 triệu' }).click();
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(page).toHaveURL(/title=Ambassador.*category=64c8f53047dcd21cb95abf37.*greater_defaultPrice=3000000.*lower_defaultPrice=6000000/);
  await expect(page.getByText('Tìm thấy 2 kết quả')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Du thuyền Ambassador Hạ Long' })).toBeVisible();
});

test('listing filters, sorts and paginates', async ({ page }) => {
  await page.goto('tim-du-thuyen');
  await page.getByText('5 sao', { exact: true }).click();
  await expect(page.getByText('Tìm thấy 45 kết quả')).toBeVisible();
  await page.getByRole('button', { name: 'Đặt lại' }).click();
  await expect(page.getByText('Tìm thấy 95 kết quả')).toBeVisible();

  await page.getByRole('button', { name: 'Sắp xếp' }).click();
  await page.getByRole('option', { name: 'Giá thấp đến cao' }).click();
  const prices = await page.locator('main').getByText(/^[\d,]+đ \/ khách$/).allTextContents();
  expect(prices.length).toBe(5);
  const values = prices.map((p) => Number(p.replace(/\D/g, '')));
  expect(values).toEqual([...values].sort((a, b) => a - b));

  await page.getByRole('button', { name: '2', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('empty state appears for a category without ships', async ({ page }) => {
  await page.goto('tim-du-thuyen?category=64c8f531d5aaae789bcf1dfa');
  await expect(page.getByText('Tìm thấy 0 kết quả')).toBeVisible();
  await expect(page.getByText('Không tìm thấy kết quả phù hợp')).toBeVisible();
});

test('detail page: room modal, total and booking validation', async ({ page }) => {
  await page.goto('du-thuyen/president-cruises-halong');
  await page.getByRole('button', { name: 'Phòng Deluxe có ban công riêng', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Nhìn ra biển')).toBeVisible();
  await modal.getByRole('button', { name: 'Tăng số phòng' }).click();
  await modal.getByRole('button', { name: 'Chọn phòng' }).click();
  await expect(page.getByText('3,850,000 đ').last()).toBeVisible();

  await page.getByRole('button', { name: /^Tăng số lượng Phòng Captain Suite/ }).click();
  await expect(page.getByText('8,950,000 đ')).toBeVisible();

  await page.getByRole('button', { name: 'Đặt ngay' }).last().click();
  const booking = page.getByRole('dialog', { name: 'Đặt du thuyền' });
  await expect(booking.getByText('8,950,000 đ')).toBeVisible();
  await booking.getByRole('button', { name: 'Đặt ngay' }).click();
  await expect(booking.getByText('Bạn phải nhập họ và tên')).toBeVisible();
  await booking.getByLabel(/Họ và tên/).fill('Khách Thử');
  await booking.getByLabel(/Số điện thoại/).fill('0912345678');
  await booking.getByLabel(/Địa chỉ email/).fill('khach@example.com');
  await booking.getByRole('button', { name: 'Đặt ngay' }).click();
  await expect(booking.getByText('Đặt chỗ thành công!')).toBeVisible();
  await booking.getByRole('button', { name: 'Đóng' }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('detail page: review form validates and appends the review', async ({ page }) => {
  await page.goto('du-thuyen/president-cruises-halong');
  const form = page.getByRole('form', { name: 'Gửi đánh giá' });
  await form.getByRole('button', { name: 'Gửi' }).click();
  await expect(form.getByText('Bạn hãy chọn số sao đánh giá')).toBeVisible();
  await form.getByRole('radio', { name: '4 sao' }).click();
  await form.getByLabel(/Họ và tên/).fill('Người Kiểm Thử');
  await form.getByLabel(/Số điện thoại/).fill('0912345678');
  await form.getByLabel(/Địa chỉ email/).fill('test@example.com');
  await form.getByLabel(/Đánh giá của bạn/).fill('Chuyến đi rất tuyệt.');
  await form.getByRole('button', { name: 'Gửi' }).click();
  await expect(page.getByText('Đánh giá (4)')).toBeVisible();
  await expect(page.getByText('Người Kiểm Thử')).toBeVisible();
});

test('contact form shows the source validation messages', async ({ page }) => {
  await page.goto('lien-he');
  await page.getByRole('button', { name: 'Liên hệ với Mixivivu' }).last().click();
  for (const msg of ['Bạn phải nhập họ và tên', 'Bạn phải nhập email', 'Bạn phải nhập số điện thoại', 'Bạn cần nhập nội dung yêu cầu']) {
    await expect(page.getByText(msg)).toBeVisible();
  }
});

test('faq accordion collapses and expands', async ({ page }) => {
  await page.goto('cau-hoi-thuong-gap');
  const q = page.getByRole('button', { name: 'Dịch vụ xe đưa đón có bao gồm trong giá tour không?' });
  const answer = page.getByText('Xe đưa đón 2 chiều không bao gồm trong giá tour.');
  await expect(answer).toBeVisible();
  await q.click();
  await expect(answer).toBeHidden();
  await q.click();
  await expect(answer).toBeVisible();
});

test('blog tabs filter posts', async ({ page }) => {
  await page.goto('blog');
  await page.getByRole('tab', { name: 'Khách sạn' }).click();
  await expect(page).toHaveURL(/type=hotel/);
  await expect(page.locator('main a[href*="blog-detail"]').filter({ hasText: /\S/ })).toHaveCount(2);
});

test('home testimonials switch on click', async ({ page }) => {
  await page.goto('');
  await page.getByRole('tab', { name: 'Anh Khánh' }).click();
  await expect(page.getByText('Du thuyền Stellar of the Seas')).toBeVisible();
});

test('flight search validates and navigates to results', async ({ page }) => {
  await page.goto('tim-ve-may-bay');
  await page.getByRole('button', { name: 'Tìm chuyến bay' }).click();
  await expect(page.getByText('Vui lòng chọn điểm đi')).toBeVisible();
  await page.getByLabel('Điểm đi').click();
  await page.getByRole('button', { name: /^Hà Nội/ }).click();
  await page.getByLabel('Điểm đến').click();
  await page.getByRole('button', { name: /^Phú Quốc/ }).click();
  await page.getByRole('button', { name: 'Tìm chuyến bay' }).click();
  await expect(page).toHaveURL(/ket-qua\?from=HAN&to=PQC/);
  await expect(page.getByText('Hà Nội (HAN)')).toBeVisible();
});

test('mobile menu opens and navigates @mobile', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await page.getByRole('navigation', { name: 'Menu di động' }).getByRole('link', { name: 'Tìm khách sạn' }).click();
  await expect(page).toHaveURL(/khach-san$/);
  await expect(page.getByRole('navigation', { name: 'Menu di động' })).toHaveCount(0);
});

test('mobile listing has no horizontal overflow @mobile', async ({ page }) => {
  for (const path of ['', 'tim-du-thuyen', 'du-thuyen/president-cruises-halong', 'lien-he', 'tim-ve-may-bay']) {
    await page.goto(path);
    await page.locator('footer').waitFor();
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
