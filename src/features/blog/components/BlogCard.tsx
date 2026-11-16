import { Link } from 'react-router-dom';
import { Card } from '@/components/common/Card';
import { ROUTES } from '@/constants/routes';
import type { BlogSummary } from '@/types/models';
import { cdnImage } from '@/utils/assets';
import { formatDate } from '@/utils/format';

export function BlogCard({ blog }: { blog: BlogSummary }) {
  return (
    <Card className="group flex h-full flex-col gap-5 pb-6">
      <Link to={ROUTES.blogDetail(blog.slug)} className="block px-4 pt-4" tabIndex={-1} aria-hidden="true">
        <div className="h-[216px] overflow-hidden rounded-image shadow-image">
          <img
            src={cdnImage(blog.thumbnail)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      </Link>
      <div className="flex flex-col items-start gap-2 px-6">
        <Link
          to={ROUTES.blogDetail(blog.slug)}
          className="line-clamp-2 h-14 text-lg font-bold leading-7 text-gray-900 hover:text-primary-dark"
        >
          {blog.title}
        </Link>
        <p className="line-clamp-2 h-10 text-sm leading-5 text-gray-600">{blog.description}</p>
      </div>
      <p className="mt-auto px-6 text-sm leading-5 text-gray-600">{formatDate(blog.date)}</p>
    </Card>
  );
}
