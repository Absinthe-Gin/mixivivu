import { useMemo } from 'react';
import type { ContentBlock } from '@/types/models';
import { cdnImage, withBasePath } from '@/utils/assets';
import { sanitizeHtml } from '@/utils/sanitizeHtml';
import { cx } from '@/utils/cx';

/** Sanitized HTML string (legal pages, FAQ answers, inline CMS text). */
export function Html({ html, className, as: Tag = 'div' }: { html: string; className?: string; as?: 'div' | 'span' | 'p' }) {
  const safe = useMemo(() => withBasePath(sanitizeHtml(html)), [html]);
  return <Tag className={cx('rich-text', className)} dangerouslySetInnerHTML={{ __html: safe }} />;
}

interface ContentBlocksProps {
  blocks: ContentBlock[];
  className?: string;
  /** Blog covers use rounded images with a shadow; product pages use square ones. */
  imageStyle?: 'plain' | 'rounded';
}

/** Renders Editor.js blocks stored by the source CMS. */
export function ContentBlocks({ blocks, className, imageStyle = 'plain' }: ContentBlocksProps) {
  return (
    <div className={cx('flex flex-col gap-6 text-base leading-6 text-gray-900', className)}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'header':
            return (
              <Html
                key={i}
                html={b.text}
                className={cx('font-bold text-gray-900', b.level <= 2 ? 'text-2xl leading-8' : 'text-xl leading-[30px]')}
              />
            );
          case 'paragraph':
            return <Html key={i} as="p" html={b.text} />;
          case 'list': {
            const Tag = b.style === 'ordered' ? 'ol' : 'ul';
            return (
              <Tag key={i} className={cx('rich-text flex flex-col gap-2 pl-6', b.style === 'ordered' ? 'list-decimal' : 'list-disc')}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Html as="span" html={item} />
                  </li>
                ))}
              </Tag>
            );
          }
          case 'image':
            return (
              <figure key={i} className="m-0 flex flex-col gap-2">
                <img
                  src={cdnImage(b.url)}
                  alt={b.caption || ''}
                  loading="lazy"
                  className={cx('w-full object-cover', imageStyle === 'rounded' && 'rounded-image shadow-image')}
                />
                {b.caption && <Html as="span" html={b.caption} className="text-center text-sm text-gray-500" />}
              </figure>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
