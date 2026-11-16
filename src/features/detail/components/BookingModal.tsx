import { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Modal } from '@/components/common/Modal';
import { Stepper } from '@/components/common/Stepper';
import { FieldShell, TextArea, TextField } from '@/components/forms/TextField';
import { isEmail, isPhone, useFormState } from '@/hooks/useFormState';
import { useClickOutside } from '@/hooks/useClickOutside';
import { submitForm } from '@/services/formService';
import { formatNumber, todayIso } from '@/utils/format';

export interface BookingContext {
  mode: 'book' | 'rent';
  productTitle: string;
  productSlug: string;
  rooms: { title: string; quantity: number; price: number }[];
  total: number;
}

interface BookingModalProps {
  context: BookingContext | null;
  onClose: () => void;
  productLabel: string;
}

type Values = { date: string; adults: number; children: number; name: string; phone: string; email: string; note: string };

const validate = (v: Values) => {
  const e: Partial<Record<keyof Values, string>> = {};
  if (!v.name.trim()) e.name = 'Bạn phải nhập họ và tên';
  if (!v.phone.trim()) e.phone = 'Bạn phải nhập số điện thoại';
  else if (!isPhone(v.phone)) e.phone = 'Số điện thoại không hợp lệ';
  if (!v.email.trim()) e.email = 'Bạn phải nhập email';
  else if (!isEmail(v.email)) e.email = 'Email không hợp lệ';
  if (!v.date) e.date = 'Bạn phải chọn ngày nhận phòng';
  else if (v.date < todayIso()) e.date = 'Ngày nhận phòng không hợp lệ';
  return e;
};

/** "Đặt du thuyền" / "Thuê trọn tàu" form with validation. */
export function BookingModal({ context, onClose, productLabel }: BookingModalProps) {
  const form = useFormState<Values>(
    { date: todayIso(), adults: 1, children: 0, name: '', phone: '', email: '', note: '' },
    validate,
  );
  const [guestsOpen, setGuestsOpen] = useState(false);
  const guestsRef = useClickOutside<HTMLDivElement>(() => setGuestsOpen(false), guestsOpen);
  const [done, setDone] = useState<null | 'book' | 'consult'>(null);
  const [sending, setSending] = useState(false);

  const close = () => {
    form.reset();
    setDone(null);
    onClose();
  };

  const send = (kind: 'book' | 'consult') =>
    form.handleSubmit(async (values) => {
      setSending(true);
      await submitForm(kind === 'book' ? 'booking' : 'consult', { ...values, ...context });
      setSending(false);
      setDone(kind);
    });

  if (!context) return null;
  const { values, errors, setField } = form;
  const title = context.mode === 'rent' ? 'Thuê trọn tàu' : `Đặt ${productLabel}`;

  return (
    <Modal open onClose={close} title={title} className="lg:!max-w-[810px]">
      {done ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center" role="status">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success-dark">
            <Icon name="check" size={28} />
          </span>
          <p className="subheading md">{done === 'book' ? 'Đặt chỗ thành công!' : 'Đăng ký tư vấn thành công!'}</p>
          <p className="md">Mixivivu sẽ liên hệ với bạn trong thời gian sớm nhất để xác nhận thông tin.</p>
          <Button onClick={close}>Đóng</Button>
        </div>
      ) : (
        <form className="flex flex-col gap-6" onSubmit={send('book')} noValidate>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <TextField
              label="Ngày nhận phòng"
              type="date"
              min={todayIso()}
              value={values.date}
              onChange={(e) => setField('date', e.target.value)}
              error={errors.date}
              icon={<Icon name="calendar" size={20} />}
            />
            <div ref={guestsRef} className="relative">
              <FieldShell id="booking-guests" label="Số lượng">
                <button
                  id="booking-guests"
                  type="button"
                  aria-expanded={guestsOpen}
                  onClick={() => setGuestsOpen((o) => !o)}
                  className="flex h-6 flex-grow items-center justify-between text-left text-base text-gray-800 !shadow-none"
                >
                  {values.adults} Người lớn - {values.children} - Trẻ em
                  <Icon name="chevronDown" size={20} className="text-gray-500" />
                </button>
              </FieldShell>
              {guestsOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-dropdown flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-dropdown">
                  {(
                    [
                      ['adults', 'Người lớn', 1],
                      ['children', 'Trẻ em', 0],
                    ] as const
                  ).map(([key, label, min]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <span className="text-base text-gray-900">{label}</span>
                      <Stepper value={values[key]} min={min} max={30} label={label} onChange={(n) => setField(key, n)} className="!py-2" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <TextField label="Họ và tên" required placeholder="Nhập họ và tên" value={values.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
          <TextField label="Số điện thoại" required type="tel" placeholder="Nhập số điện thoại" value={values.phone} onChange={(e) => setField('phone', e.target.value)} error={errors.phone} />
          <TextField label="Địa chỉ email" required type="email" placeholder="Nhập email" value={values.email} onChange={(e) => setField('email', e.target.value)} error={errors.email} />
          <TextArea label="Yêu cầu của bạn" placeholder="Nhập yêu cầu của bạn" value={values.note} onChange={(e) => setField('note', e.target.value)} />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {context.mode === 'book' ? (
              <div>
                <p className="sm text-gray-900">Tổng tiền</p>
                <p className="text-xl font-bold leading-[30px] text-primary-dark">{formatNumber(context.total)} đ</p>
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => send('consult')()} disabled={sending}>
                Đăng ký tư vấn
              </Button>
              <Button type="submit" iconRight={<Icon name="arrowRight" />} disabled={sending}>
                Đặt ngay
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
