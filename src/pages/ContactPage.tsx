import { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { TextArea, TextField } from '@/components/forms/TextField';
import { SITE } from '@/config/site';
import { CONTACT_COPY } from '@/data/content';
import { isEmail, isPhone, useFormState } from '@/hooks/useFormState';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { submitForm } from '@/services/formService';

type Values = { name: string; email: string; phone: string; message: string };

// Error copy matches the source site.
const validate = (v: Values) => {
  const e: Partial<Record<keyof Values, string>> = {};
  if (!v.name.trim()) e.name = 'Bạn phải nhập họ và tên';
  if (!v.email.trim()) e.email = 'Bạn phải nhập email';
  else if (!isEmail(v.email)) e.email = 'Email không hợp lệ';
  if (!v.phone.trim()) e.phone = 'Bạn phải nhập số điện thoại';
  else if (!isPhone(v.phone)) e.phone = 'Số điện thoại không hợp lệ';
  if (!v.message.trim()) e.message = 'Bạn cần nhập nội dung yêu cầu';
  return e;
};

export function ContactPage() {
  useDocumentTitle('Liên hệ');
  const form = useFormState<Values>({ name: '', email: '', phone: '', message: '' }, validate);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const { values, errors, setField } = form;

  const onSubmit = form.handleSubmit(async (v) => {
    setStatus('sending');
    await submitForm('contact', v);
    form.reset();
    setStatus('sent');
  });

  return (
    <div className="pb-20">
      <div className="overflow-hidden lg:mx-6 lg:rounded-b-[32px]">
        <iframe
          title="Bản đồ văn phòng Mixivivu"
          src={SITE.officeMapEmbed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-[320px] w-full border-0 lg:h-[720px]"
        />
      </div>
      <Card className="relative z-[1] mx-4 -mt-20 flex flex-col gap-10 p-6 lg:mx-auto lg:-mt-[320px] lg:w-[1008px] lg:p-6 lg:pt-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="m-0 text-2xl font-bold leading-8 text-gray-900 lg:text-[36px] lg:leading-[44px]">{CONTACT_COPY.title}</h1>
          <p className="lg">{CONTACT_COPY.description}</p>
        </div>
        {status === 'sent' && (
          <p role="status" className="rounded-xl bg-success-light px-4 py-3 text-center text-success-dark">
            Cảm ơn bạn! Mixivivu đã nhận được yêu cầu và sẽ liên hệ lại sớm nhất.
          </p>
        )}
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <TextField label="Họ và tên" required placeholder="Nhập họ và tên" value={values.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <TextField label="Email" required type="email" placeholder="Nhập email" value={values.email} onChange={(e) => setField('email', e.target.value)} error={errors.email} />
            <TextField label="Số điện thoại" required type="tel" placeholder="Nhập số điện thoại" value={values.phone} onChange={(e) => setField('phone', e.target.value)} error={errors.phone} />
          </div>
          <TextArea label="Nội dung" required placeholder="Nhập yêu cầu của bạn" value={values.message} onChange={(e) => setField('message', e.target.value)} error={errors.message} />
          <Button type="submit" fullWidth disabled={status === 'sending'} iconRight={<Icon name="arrowRight" />}>
            Liên hệ với Mixivivu
          </Button>
        </form>
      </Card>
    </div>
  );
}
