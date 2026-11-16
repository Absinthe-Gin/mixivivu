const numberFormat = new Intl.NumberFormat('en-US');

/** Prices are shown the way the source shows them: 3,850,000. */
export const formatNumber = (value: number) => numberFormat.format(value);

/** ISO date (yyyy-mm-dd...) to dd/mm/yyyy. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Lower-case, accent-free text for search matching. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
