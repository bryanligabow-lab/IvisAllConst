import { z } from 'zod';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Zod schema for "calendar date" fields (day, month, year — no clock time).
 *
 * When the client sends `"2026-02-27"` we want it persisted as exactly
 * Feb 27, 2026 regardless of the server / display timezone. The default
 * `z.coerce.date()` parses that string as 2026-02-27T00:00:00Z which, in
 * Ecuador (UTC-5), shows as Feb 26 19:00 → the date silently shifts back
 * by one day when re-read.
 *
 * The fix is to anchor calendar dates at **12:00 UTC**: every timezone in
 * the world (UTC-12 through UTC+14) lands on the same calendar day at noon
 * UTC, so the day component never drifts. ISO timestamps and full Date
 * objects are accepted unchanged.
 */
export const calendarDateSchema = z.preprocess((value) => {
  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value)) {
    return new Date(`${value}T12:00:00.000Z`);
  }
  return value;
}, z.coerce.date());

export const optionalCalendarDateSchema = calendarDateSchema.optional();
