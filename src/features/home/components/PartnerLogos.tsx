import { SectionHeader } from '@/components/common/SectionHeader';
import { publicAsset } from '@/utils/assets';

interface PartnerLogosProps {
  title: string;
  description: string;
  logos: string[];
}

export function PartnerLogos({ title, description, logos }: PartnerLogosProps) {
  return (
    <section className="section-bg bg-gray-50 py-16 [background-blend-mode:multiply] lg:py-20">
      <div className="container-page flex flex-col gap-10 px-4 lg:gap-16 lg:px-8">
        <SectionHeader title={title} description={description} />
        <ul className="grid grid-cols-2 items-center gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {logos.map((src) => (
            <li key={src} className="flex h-[88px] items-center justify-center">
              <img src={publicAsset(src)} alt="Đối tác" loading="lazy" className="max-h-full max-w-full object-contain" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
