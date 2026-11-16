import { useParams } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { ContentBlocks } from '@/components/common/RichText';
import { HeadingBorder } from '@/components/common/SectionHeader';
import { ErrorState, Loading } from '@/components/feedback/States';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';
import { NotFoundError } from '@/services/http';
import { formatDate } from '@/utils/format';
import { NotFoundPage } from './NotFoundPage';

export function BlogDetailPage() {
  const { slug = '' } = useParams();
  const blog = useAsync(() => catalogService.blog(slug), [slug]);
  useDocumentTitle(blog.data?.title);

  if (blog.error instanceof NotFoundError) return <NotFoundPage />;
  if (blog.error) return <ErrorState error={blog.error} onRetry={blog.reload} />;
  if (!blog.data || blog.data.slug !== slug) return <Loading className="min-h-[60vh]" />;

  const b = blog.data;
  // The first image block doubles as the article cover (rounded with shadow).
  const [first, ...rest] = b.content;
  const cover = first?.type === 'image' ? first : null;

  return (
    <article className="container-page flex flex-col gap-10 px-4 py-16 lg:px-8 lg:py-20">
      <header className="flex flex-col gap-6">
        <h1 className="m-0 text-2xl font-bold leading-8 text-gray-900 lg:text-[30px] lg:leading-[38px]">{b.title}</h1>
        <Badge>{formatDate(b.date)}</Badge>
        <HeadingBorder />
        {b.description && <p className="text-base italic leading-6 text-gray-600">{b.description}</p>}
      </header>
      {cover && <ContentBlocks blocks={[cover]} imageStyle="rounded" className="mt-10" />}
      <ContentBlocks blocks={cover ? rest : b.content} />
    </article>
  );
}
