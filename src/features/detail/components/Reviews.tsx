import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Stars } from '@/components/common/RatingBadge';
import { HeadingBorder } from '@/components/common/SectionHeader';
import { TextArea, TextField } from '@/components/forms/TextField';
import { isEmail, isPhone, useFormState } from '@/hooks/useFormState';
import { submitForm } from '@/services/formService';
import type { Review } from '@/types/models';
import { formatDate, normalizeText, todayIso } from '@/utils/format';
import { cx } from '@/utils/cx';

const PAGE = 5;

type Values = { score: number; name: string; phone: string; email: string; comment: string };
const validate = (v: Values) => {
  const e: Partial<Record<keyof Values, string>> = {};
  if (!v.score) e.score = 'Bạn hãy chọn số sao đánh giá';
  if (!v.name.trim()) e.name = 'Bạn phải nhập họ và tên';
  if (!v.phone.trim()) e.phone = 'Bạn phải nhập số điện thoại';
  else if (!isPhone(v.phone)) e.phone = 'Số điện thoại không hợp lệ';
  if (!v.email.trim()) e.email = 'Bạn phải nhập email';
  else if (!isEmail(v.email)) e.email = 'Email không hợp lệ';
  if (!v.comment.trim()) e.comment = 'Bạn phải nhập đánh giá';
  return e;
};

/** Rating summary, searchable review list and the "send a review" form. */
export function Reviews({ productSlug, initial }: { productSlug: string; initial: Review[] }) {
  const [added, setAdded] = useState<Review[]>([]);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [thanks, setThanks] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const form = useFormState<Values>({ score: 0, name: '', phone: '', email: '', comment: '' }, validate);

  const all = useMemo(() => [...initial, ...added], [initial, added]);
  const avg = all.length ? all.reduce((s, r) => s + r.score, 0) / all.length : 0;
  const counts = [1, 2, 3, 4, 5].map((s) => all.filter((r) => Math.round(r.score) === s).length);
  const shown = useMemo(() => {
    const q = normalizeText(search);
    return q ? all.filter((r) => normalizeText(`${r.name} ${r.comment}`).includes(q)) : all;
  }, [all, search]);

  const onSubmit = form.handleSubmit(async (v) => {
    await submitForm('review', { product: productSlug, ...v });
    // Only public fields are shown back; contact details stay in the submission.
    setAdded((a) => [...a, { id: `local-${Date.now()}`, name: v.name.trim(), score: v.score, comment: v.comment.trim(), date: todayIso() }]);
    form.reset();
    setThanks(true);
  });

  const { values, errors, setField } = form;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-6">
          <h4 className="m-0 text-[30px] leading-[38px] lg:text-[36px] lg:leading-[44px]">Đánh giá ({all.length})</h4>
          <HeadingBorder />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 shadow-xs focus-within:border-primary">
            <Icon name="search" size={18} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm đánh giá"
              aria-label="Tìm đánh giá"
              className="w-36 border-none text-base outline-none placeholder:text-gray-400"
            />
          </label>
          <Button size="sm" iconLeft={<Icon name="star" size={18} />} onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            Gửi đánh giá
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-6 p-6 md:flex-row md:items-center">
        <div className="flex items-center justify-center gap-4 md:w-[240px] md:border-r md:border-gray-200">
          <span className="text-[36px] font-bold leading-[44px] text-warning">{avg.toFixed(2)}</span>
          <Icon name="star" size={36} className="text-warning" />
        </div>
        <ul className="flex flex-1 flex-col gap-3">
          {counts.map((c, i) => (
            <li key={i} className="flex items-center gap-4 text-base text-info">
              <span className="w-12 shrink-0">{i + 1} sao</span>
              <span className="h-1 flex-1 overflow-hidden rounded bg-gray-100">
                <span className="block h-full bg-warning" style={{ width: all.length ? `${(c / all.length) * 100}%` : 0 }} />
              </span>
              <span className="w-24 shrink-0 text-right">{c} đánh giá</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-5">
        {shown.length === 0 && <p className="md">{search ? 'Không có đánh giá phù hợp.' : 'Chưa có đánh giá nào. Hãy là người đầu tiên!'}</p>}
        {shown.slice(0, limit).map((r) => (
          <Card key={r.id} className="flex flex-col gap-6 p-6">
            <Stars value={r.score} />
            <p className="text-base font-medium text-gray-900">{r.name}</p>
            <p className="sm text-gray-600">{r.comment}</p>
            <p className="sm text-gray-600">{formatDate(r.date)}</p>
          </Card>
        ))}
        {shown.length > limit && (
          <Button variant="outline" className="self-center" onClick={() => setLimit((l) => l + PAGE)}>
            Xem thêm đánh giá
          </Button>
        )}
      </div>

      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-6 border-t border-gray-200 pt-10" aria-label="Gửi đánh giá">
        {thanks && (
          <p role="status" className="rounded-xl bg-success-light px-4 py-3 text-sm text-success-dark">
            Cảm ơn bạn đã gửi đánh giá!
          </p>
        )}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className={cx('flex items-center gap-4 rounded-input border px-5 py-3 shadow-xs', errors.score ? 'border-error' : 'border-gray-200')}>
              <span className="label-sm text-gray-900">Chất lượng</span>
              <div className="flex gap-3" role="radiogroup" aria-label="Chất lượng">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={values.score === s}
                    aria-label={`${s} sao`}
                    onClick={() => setField('score', s)}
                    className={cx('!shadow-none transition-colors', s <= values.score ? 'text-warning' : 'text-gray-400 hover:text-warning')}
                  >
                    <Icon name="star" size={28} filled={s <= values.score} />
                  </button>
                ))}
              </div>
            </div>
            {errors.score && <p className="sm text-error">{errors.score}</p>}
          </div>
          <TextField label="Họ và tên" required placeholder="Nhập họ và tên" value={values.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
          <TextField label="Số điện thoại" required type="tel" placeholder="Nhập số điện thoại" value={values.phone} onChange={(e) => setField('phone', e.target.value)} error={errors.phone} />
          <TextField label="Địa chỉ email" required type="email" placeholder="Nhập email" value={values.email} onChange={(e) => setField('email', e.target.value)} error={errors.email} />
        </div>
        <TextArea label="Đánh giá của bạn" required placeholder="Nhập yêu cầu của bạn" value={values.comment} onChange={(e) => setField('comment', e.target.value)} error={errors.comment} />
        <Button type="submit" className="self-end" iconRight={<Icon name="arrowRight" />}>
          Gửi
        </Button>
      </form>
    </div>
  );
}
