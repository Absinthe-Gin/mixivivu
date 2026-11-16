import { Card } from '@/components/common/Card';
import { Icon, type IconName } from '@/components/common/Icon';

export interface InfoRow {
  icon: IconName;
  label: string;
  value: string | number | undefined;
}

export function InfoCard({ title, rows }: { title: string; rows: InfoRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-5 text-base font-medium text-gray-900">{title}</div>
      <dl className="flex flex-col gap-4 px-6 py-6">
        {rows
          .filter((r) => r.value !== undefined && r.value !== '')
          .map((r) => (
            <div key={r.label} className="grid grid-cols-[116px_1fr] gap-4 text-base leading-6">
              <dt className="flex items-start gap-2 text-gray-600">
                <Icon name={r.icon} size={20} className="mt-0.5 shrink-0" />
                {r.label}
              </dt>
              <dd className="m-0 text-gray-900">{r.value}</dd>
            </div>
          ))}
      </dl>
    </Card>
  );
}
