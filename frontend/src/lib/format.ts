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

// Calendar dates (no clock time) are anchored at 12:00 UTC by the API so
// they never drift between timezones. Format them in UTC so we always read
// back the same Y-M-D the user typed, regardless of the browser's locale.
const calendarDate = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatCurrency = (n: number, detailed = false): string =>
  detailed ? currencyDetailed.format(n) : currency.format(n);

export const formatPercent = (n: number): string => percent.format(n);

export const formatDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return date.format(dt);
};

/**
 * Format a "calendar date" (day-month-year, no clock time). Use this for
 * gastoDate, scheduledDate, periodStart/End, hireDate, project start/end,
 * proforma date — fields the user typed via a date picker. Backend stores
 * them anchored at 12:00 UTC so we format in UTC and the day never shifts.
 */
export const formatCalendarDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return calendarDate.format(dt);
};
