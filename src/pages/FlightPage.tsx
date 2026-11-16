import { SITE } from '@/config/site';
import { FLIGHT_PARTNERS, HOME_COPY } from '@/data/content';
import { FLIGHT_TESTIMONIALS } from '@/data/testimonials';
import { FlightSearchForm } from '@/features/flight/FlightSearchForm';
import { PartnerLogos } from '@/features/home/components/PartnerLogos';
import { Testimonials } from '@/features/home/components/Testimonials';
import { VideoHero } from '@/features/home/components/VideoHero';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function FlightPage() {
  useDocumentTitle('Tìm vé máy bay');
  return (
    <>
      <VideoHero src={SITE.heroVideos.flight} overlap="flight">
        <div className="container-page px-0 lg:px-8">
          <FlightSearchForm />
        </div>
      </VideoHero>
      <div className="h-16 lg:h-20" />
      <Testimonials tinted={false} title={HOME_COPY.ship.reviewsTitle} description={HOME_COPY.ship.reviewsDescription} items={FLIGHT_TESTIMONIALS} />
      <PartnerLogos title={HOME_COPY.flight.partnersTitle} description={HOME_COPY.flight.partnersDescription} logos={FLIGHT_PARTNERS} />
    </>
  );
}
