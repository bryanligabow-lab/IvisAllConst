const LOCALE = 'es-EC';
const CURRENCY = 'USD';

const currency = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const currencyDetailed = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  maximumFractionDigits: 1,
});

const date = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const formatCurrency = (n: number, detailed = false): string =>
  detailed ? currencyDetailed.format(n) : currency.format(n);

export const formatPercent = (n: number): string => percent.format(n);

export const formatDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return date.format(dt);
};
