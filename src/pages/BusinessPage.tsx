import { ButtonLink } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ROUTES } from '@/constants/routes';
import { BUSINESS, HOME_COPY, SHIP_PARTNERS } from '@/data/content';
import { SearchBox } from '@/features/catalog/components/SearchBox';
import { useShipLookups } from '@/features/catalog/hooks';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';
import { publicAsset } from '@/utils/assets';

export function BusinessPage() {
  useDocumentTitle('Doanh nghiệp');
  const { lookups } = useShipLookups();
  const ships = useAsync(() => catalogService.ships(), []);

  return (
    <>
      <div className="section-bg">
        <div className="container-page flex flex-col gap-16 px-4 py-10 lg:gap-20 lg:px-8 lg:pb-20 lg:pt-20">
          <SearchBox
            variant="listing"
            title={HOME_COPY.ship.searchTitle}
            description={BUSINESS.searchDescription}
            placeholder="Nhập tên du thuyền"
            searchPath={ROUTES.shipSearch}
            locations={lookups.categories}
            suggestions={(ships.data ?? []).map((s) => ({ title: s.title, to: ROUTES.shipDetail(s.slug) }))}
          />
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-8 lg:w-[600px]">
              <SectionHeader layout="column" title={BUSINESS.title} />
              <p className="lg" style={{ color: 'var(--gray-600)' }}>
                {BUSINESS.description}
              </p>
              <ButtonLink to={ROUTES.contact} className="mt-8 self-start" iconRight={<Icon name="arrowRight" />}>
                Liên hệ với Mixivivu
              </ButtonLink>
            </div>
            <div className="flex flex-col gap-6 lg:w-[488px]">
              {BUSINESS.cards.map((c) => (
                <Card key={c.title} className="flex gap-6 p-4">
                  <img src={publicAsset(c.img)} alt="" className="h-[120px] w-[120px] shrink-0 rounded-2xl object-cover" />
                  <div className="flex flex-col gap-4 pt-2">
                    <h6 className="m-0 text-xl leading-[30px] text-gray-900 lg:text-2xl lg:leading-8">{c.title}</h6>
                    <p className="sm text-gray-600">{c.content}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
      <section className="section-bg bg-[#f5feff] py-16 [background-blend-mode:multiply] lg:py-20">
        <div className="container-page flex flex-col gap-10 px-4 lg:gap-16 lg:px-0">
          <SectionHeader title={BUSINESS.customersTitle} description={BUSINESS.customersDescription} />
          <ul className="flex snap-x gap-10 overflow-x-auto pb-2">
            {SHIP_PARTNERS.map((src) => (
              <li key={src} className="flex h-[88px] w-[180px] shrink-0 snap-start items-center justify-center">
                <img src={publicAsset(src)} alt="Khách hàng" loading="lazy" className="max-h-full max-w-full object-contain" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
