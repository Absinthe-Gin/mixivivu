import { Link } from 'react-router-dom';
import { FOOTER_COLUMNS, SITE } from '@/config/site';
import { publicAsset } from '@/utils/assets';

export function Footer() {
  return (
    <footer>
      <div className="bg-gray-900 text-gray-400">
        <div className="mx-auto flex w-full max-w-[1216px] flex-col items-start gap-12 px-4 py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-0 lg:pb-12 lg:pt-16">
          <div className="flex w-full flex-col gap-6 font-medium text-white lg:w-[max(25%,320px)]">
            <img src={publicAsset('assets/logos/white-logo.png')} alt="Mixivivu" width={156} height={42} className="h-[42px] w-[156px] object-contain" />
            <p>{SITE.company}</p>
            <p>{SITE.address}</p>
            <p>{SITE.businessLicense}</p>
          </div>
          <div className="grid w-full flex-grow grid-cols-1 gap-8 sm:grid-cols-3 lg:gap-16">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-4">
                <span className="text-sm font-semibold text-gray-500">{col.title}</span>
                <ul className="flex flex-col gap-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.external ? (
                        <a href={l.to} className="font-semibold transition-colors hover:text-primary">
                          {l.label}
                        </a>
                      ) : (
                        <Link to={l.to} className="font-semibold transition-colors hover:text-primary">
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-gray-800 px-4 lg:px-0">
        <div className="mx-auto w-full max-w-[1216px] py-12 text-gray-500">
          <p>{SITE.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
