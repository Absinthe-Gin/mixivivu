import { Html } from '@/components/common/RichText';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ErrorState, Loading } from '@/components/feedback/States';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';

/** Legal/help pages rendered from captured CMS HTML in public/data/pages. */
function StaticContentPage({ pageKey }: { pageKey: string }) {
  const page = useAsync(() => catalogService.page(pageKey), [pageKey]);
  useDocumentTitle(page.data?.title);

  if (page.error) return <ErrorState error={page.error} onRetry={page.reload} />;
  if (!page.data) return <Loading className="min-h-[60vh]" />;

  return (
    <div className="container-page flex flex-col gap-10 px-4 py-16 lg:px-8 lg:py-20">
      <SectionHeader as="h1" title={page.data.title} />
      <Html
        html={page.data.html}
        className="flex flex-col [&_.subheading]:text-gray-900 [&_img]:my-4 [&_img]:max-w-full [&_p.md]:text-gray-600 [&_li]:text-gray-600"
      />
    </div>
  );
}

export const ShipRulesPage = () => <StaticContentPage pageKey="quy-dinh-chung-va-luu-y" />;
export const HotelRulesPage = () => <StaticContentPage pageKey="khach-san-quy-dinh-chung-va-luu-y" />;
export const TermsPage = () => <StaticContentPage pageKey="dieu-khoan-va-dieu-kien" />;
export const PrivacyPage = () => <StaticContentPage pageKey="chinh-sach-rieng-tu" />;
export const GuidePage = () => <StaticContentPage pageKey="huong-dan-su-dung" />;
export const PaymentPage = () => <StaticContentPage pageKey="hinh-thuc-thanh-toan" />;
