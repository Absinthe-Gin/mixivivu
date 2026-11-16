import { useEffect, useState } from 'react';
import { Tabs, type TabItem } from '@/components/common/Tabs';

/** Sticky anchor tabs that scroll to the matching section and track the visible one. */
export function SectionNav<V extends string>({ items }: { items: TabItem<V>[] }) {
  const [active, setActive] = useState<V>(items[0].value);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as V);
      },
      { rootMargin: '-160px 0px -55% 0px' },
    );
    items.forEach((i) => {
      const el = document.getElementById(i.value);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  const go = (id: V) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 170, behavior: 'smooth' });
  };

  return (
    <div className="sticky top-[96px] z-10 bg-white py-2">
      <Tabs ariaLabel="Mục lục" items={items} value={active} onChange={go} />
    </div>
  );
}
