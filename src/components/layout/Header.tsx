import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ButtonLink } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { MAIN_NAV, SITE, type NavItem } from '@/config/site';
import { ROUTES } from '@/constants/routes';
import { publicAsset } from '@/utils/assets';
import { cx } from '@/utils/cx';

const isActive = (item: NavItem, pathname: string) =>
  (item.match ?? [item.to]).some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Home pages render the header without the bottom border. */
const BORDERLESS = [ROUTES.home, ROUTES.hotelHome];

export function Header() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={cx(
        'sticky top-0 z-header bg-white',
        !BORDERLESS.includes(pathname as (typeof BORDERLESS)[number]) && 'border-b border-gray-200',
      )}
    >
      <div className="mx-auto flex h-header max-w-container items-center justify-between gap-4 px-4 xl:px-0">
        <Link to={ROUTES.home} aria-label="Mixivivu - Trang chủ" className="shrink-0">
          <img
            src={publicAsset('assets/logos/black-logo.png')}
            alt="Mixivivu"
            className="h-[30px] w-[120px] object-contain lg:h-[42px] lg:w-[156px]"
          />
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden h-full flex-1 items-stretch gap-6 pl-6 lg:flex xl:pl-[75px]">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={() =>
                cx(
                  'flex items-center whitespace-nowrap border-b-2 text-base leading-6 transition-colors hover:text-primary',
                  isActive(item, pathname) ? 'border-primary text-primary-dark' : 'border-transparent text-gray-900',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <a href={`tel:${SITE.hotline}`} className="hidden items-center gap-2.5 whitespace-nowrap font-bold text-primary-dark xl:flex">
            <Icon name="phone" size={18} filled strokeWidth={0} />
            Hotline: {SITE.hotline}
          </a>
          <ButtonLink to={ROUTES.contact} size="sm" className="!py-2.5 !text-sm">
            Liên hệ Mixivivu
          </ButtonLink>
          <button
            type="button"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center !shadow-none text-gray-900 lg:hidden"
          >
            <Icon name={menuOpen ? 'close' : 'grid'} size={22} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-menu"
          aria-label="Menu di động"
          className="absolute left-0 right-0 top-full border-t border-gray-200 bg-white shadow-dropdown lg:hidden"
        >
          {MAIN_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cx(
                'flex w-full items-center px-5 py-[15px] text-base',
                isActive(item, pathname) ? 'bg-primary text-white' : 'text-black',
              )}
            >
              {item.label}
            </Link>
          ))}
          <a href={`tel:${SITE.hotline}`} className="flex items-center gap-2 px-5 py-[15px] font-bold text-primary-dark">
            <Icon name="phone" size={18} filled strokeWidth={0} />
            Hotline: {SITE.hotline}
          </a>
        </nav>
      )}
    </header>
  );
}
