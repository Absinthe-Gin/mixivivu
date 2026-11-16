import { useId, useState, type ReactNode } from 'react';
import { Card } from './Card';
import { Icon } from './Icon';

interface AccordionItemProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** FAQ card: header toggles the answer; the source starts every item open. */
export function AccordionItem({ title, children, defaultOpen = true }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 !rounded-none bg-transparent px-6 py-6 text-left !shadow-none"
      >
        <span className="subheading sm" style={{ color: 'var(--gray-800)' }}>
          {title}
        </span>
        <Icon name={open ? 'minus' : 'plus'} size={20} className="shrink-0 text-primary" />
      </button>
      <div id={id} hidden={!open} className="rich-text px-6 pb-6 text-gray-600 [&_p]:text-sm [&_p]:leading-5">
        {children}
      </div>
    </Card>
  );
}
