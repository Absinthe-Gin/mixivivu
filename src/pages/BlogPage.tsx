import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/common/Pagination';
import { SectionHeader } from '@/components/common/SectionHeader';
import { Tabs } from '@/components/common/Tabs';
import { EmptyState, ErrorState, Loading } from '@/components/feedback/States';
import { BLOG_TABS, HOME_COPY } from '@/data/content';
import { BlogCard } from '@/features/blog/components/BlogCard';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';
import type { BlogType } from '@/types/models';

const PAGE_SIZE = 6;
type TabValue = 'all' | BlogType;

export function BlogPage() {
  useDocumentTitle('Blog');
  const blogs = useAsync(() => catalogService.blogs(), []);
  const [params, setParams] = useSearchParams();
  const tab = (BLOG_TABS.find((t) => t.value === params.get('type'))?.value ?? 'all') as TabValue;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const filtered = useMemo(() => (blogs.data ?? []).filter((b) => tab === 'all' || b.type === tab), [blogs.data, tab]);
  const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const go = (next: { type?: TabValue; page?: number }) => {
    const p = new URLSearchParams();
    const t = next.type ?? tab;
    if (t !== 'all') p.set('type', t);
    if ((next.page ?? 1) > 1) p.set('page', String(next.page));
    setParams(p);
  };

  return (
    <div className="container-page flex flex-col gap-10 px-4 py-16 lg:gap-20 lg:px-8 lg:py-20">
      <SectionHeader layout="column" as="h1" title={HOME_COPY.blog.title} description={HOME_COPY.blog.description} />
      <Tabs ariaLabel="Loại bài viết" items={BLOG_TABS} value={tab} onChange={(type) => go({ type })} />
      {blogs.error ? (
        <ErrorState error={blogs.error} onRetry={blogs.reload} />
      ) : !blogs.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title="Chưa có bài viết" description="Chưa có bài viết nào trong mục này." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {items.map((b) => (
              <BlogCard key={b.id} blog={b} />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={(p) => {
              go({ page: p });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}
    </div>
  );
}
