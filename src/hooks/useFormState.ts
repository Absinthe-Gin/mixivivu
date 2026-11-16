import { useState } from 'react';

export type Validator<T> = (values: T) => Partial<Record<keyof T, string>>;

/** Small controlled-form helper with submit-time validation. */
export function useFormState<T extends Record<string, unknown>>(initial: T, validate: Validator<T>) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const setField = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (submitted) setErrors(validate(next));
      return next;
    });
  };

  const handleSubmit = (onValid: (values: T) => void | Promise<void>) => async (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    setSubmitted(true);
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) await onValid(values);
  };

  const reset = () => {
    setValues(initial);
    setErrors({});
    setSubmitted(false);
  };

  return { values, errors, setField, handleSubmit, reset };
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const isPhone = (v: string) => /^(\+?84|0)\d{9,10}$/.test(v.replace(/[\s.-]/g, ''));
