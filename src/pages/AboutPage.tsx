import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ABOUT } from '@/data/about';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { publicAsset } from '@/utils/assets';

const Heading = ({ children }: { children: string }) => <h2 className="m-0 text-2xl font-bold leading-8 text-gray-900">{children}</h2>;
const Para = ({ children }: { children: string }) => <p className="md">{children}</p>;

export function AboutPage() {
  useDocumentTitle('Về chúng tôi');
  const { intro, why, services, partners, contact } = ABOUT;
  return (
    <div className="container-page flex flex-col gap-10 px-4 py-16 lg:gap-20 lg:px-8 lg:py-20">
      <SectionHeader as="h1" title={ABOUT.title} />
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <Heading>{intro.heading}</Heading>
          <Para>{intro.text}</Para>
        </section>

        <section className="flex flex-col gap-4">
          <Heading>{why.heading}</Heading>
          <Para>{why.text}</Para>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {why.cards.map((c) => (
              <Card key={c.title} className="flex flex-col gap-6 p-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-dark">
                  <Icon name={c.icon} size={22} />
                </span>
                <h3 className="m-0 text-base font-bold leading-6 text-gray-900">{c.title}</h3>
                <p className="sm text-gray-700">{c.text}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <Heading>{services.heading}</Heading>
          <Para>{services.text}</Para>
          <ul className="list-disc pl-5 text-base leading-6 text-gray-600">
            {services.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <Para>{services.outro}</Para>
        </section>

        <section className="flex flex-col gap-4">
          <Heading>{partners.heading}</Heading>
          <Para>{partners.text}</Para>
          {partners.items.map((p) => (
            <Card key={p.url} className="flex flex-col gap-6 p-6">
              <div className="flex items-center justify-between gap-4">
                <img src={publicAsset(p.logo)} alt={p.role} className="h-8 w-auto" />
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary-dark hover:text-primary">
                  <Icon name="arrowRight" size={18} /> Website
                </a>
              </div>
              <h3 className="m-0 text-base font-bold leading-6 text-gray-900">{p.role}</h3>
              <p className="md !text-gray-700">{p.text}</p>
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <Heading>{contact.heading}</Heading>
          <Card className="flex flex-col gap-4 p-6">
            <div>
              <p className="text-lg font-bold leading-7 text-gray-900">{contact.company}</p>
              <p className="sm font-medium text-gray-700">{contact.companyEn}</p>
            </div>
            <div className="text-sm leading-5 text-gray-700">
              {contact.legal.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
            <div className="text-sm leading-5 text-gray-700">
              {contact.lines.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
