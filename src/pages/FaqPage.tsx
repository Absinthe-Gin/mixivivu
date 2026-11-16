import { AccordionItem } from '@/components/common/Accordion';
import { Html } from '@/components/common/RichText';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ErrorState, Loading } from '@/components/feedback/States';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';

function FaqPage({ kind }: { kind: 'ship' | 'hotel' }) {
  useDocumentTitle('Câu hỏi thường gặp');
  const faqs = useAsync(() => catalogService.faqs(kind), [kind]);
  return (
    <div className="container-page flex flex-col gap-10 px-4 py-16 lg:gap-20 lg:px-8 lg:py-20">
      <SectionHeader as="h1" title="Câu hỏi thường gặp" />
      {faqs.error ? (
        <ErrorState error={faqs.error} onRetry={faqs.reload} />
      ) : !faqs.data ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-4">
          {faqs.data.map((f) => (
            <AccordionItem key={f.question} title={f.question}>
              <Html html={f.answer} />
            </AccordionItem>
          ))}
        </div>
      )}
    </div>
  );
}

export const ShipFaqPage = () => <FaqPage kind="ship" />;
export const HotelFaqPage = () => <FaqPage kind="hotel" />;
