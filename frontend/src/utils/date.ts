/**
 * Utility functions for timezone handling and date formatting.
 * All exam schedules and operational times are synchronized to
 * Waktu Indonesia Barat (WIB / Asia/Jakarta, UTC+7).
 */

export const TIMEZONE_WIB = 'Asia/Jakarta';
export const TIMEZONE_OFFSET_HOURS = 7;

/**
 * Converts a Date or ISO string into a YYYY-MM-DDTHH:mm string in WIB (Asia/Jakarta).
 * Suitable for binding directly to <input type="datetime-local" /> without browser timezone shifts.
 */
export function formatToWIBInput(dateInput?: Date | string | number | null): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_WIB,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  if (hour === '24') hour = '00';
  const minute = get('minute');

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Converts a datetime-local input string (representing WIB time) into a standard UTC ISO-8601 string
 * for backend persistence.
 * E.g. "2026-10-19T08:00" -> "2026-10-19T01:00:00.000Z"
 */
export function wibInputToISOString(inputValue: string): string {
  if (!inputValue) return '';
  const trimmed = inputValue.trim();

  // If format is YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss, attach +07:00
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    const date = new Date(`${withSeconds}+07:00`);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Fallback for full ISO strings or dates already containing timezone
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  return '';
}

/**
 * Formats a Date or ISO string into a localized Indonesian date string in WIB (Asia/Jakarta).
 * E.g. "Senin, 19 Oktober 2026"
 */
export function formatWIBDate(
  dateInput?: Date | string | number | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE_WIB,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(date);
}

/**
 * Formats a Date or ISO string into a localized Indonesian short date string in WIB (Asia/Jakarta).
 * E.g. "19/10/2026"
 */
export function formatWIBDateShort(dateInput?: Date | string | number | null): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE_WIB,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats a Date or ISO string into time in WIB.
 * E.g. "08.00 WIB"
 */
export function formatWIBTime(
  dateInput?: Date | string | number | null,
  withSuffix = true
): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  const timeStr = new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE_WIB,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);

  return withSuffix ? `${timeStr} WIB` : timeStr;
}

/**
 * Formats a Date or ISO string into a short date + time in WIB.
 * E.g. "19/10/2026, 08.00 WIB"
 */
export function formatWIBDateTime(
  dateInput?: Date | string | number | null,
  withSuffix = true
): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  const datePart = formatWIBDateShort(date);
  const timePart = formatWIBTime(date, false);

  return withSuffix ? `${datePart}, ${timePart} WIB` : `${datePart}, ${timePart}`;
}

/**
 * Formats a start and end date range into a synchronized schedule string in WIB.
 * E.g. "Senin, 19 Oktober 2026 · 08.00–10.00 WIB"
 */
export function formatWIBScheduleRange(
  startsAt?: Date | string | number | null,
  endsAt?: Date | string | number | null
): string {
  if (!startsAt) return '-';
  const startDate = typeof startsAt === 'string' || typeof startsAt === 'number' ? new Date(startsAt) : startsAt;
  if (isNaN(startDate.getTime())) return '-';

  const dateStr = formatWIBDate(startDate);
  const startTime = formatWIBTime(startDate, false);

  if (!endsAt) return `${dateStr} · ${startTime} WIB`;
  const endDate = typeof endsAt === 'string' || typeof endsAt === 'number' ? new Date(endsAt) : endsAt;
  if (isNaN(endDate.getTime())) return `${dateStr} · ${startTime} WIB`;

  const endTime = formatWIBTime(endDate, false);
  return `${dateStr} · ${startTime}–${endTime} WIB`;
}

/**
 * Formats a start and end time range for card badges or timetable rows.
 * E.g. "08.00–09.30 WIB"
 */
export function formatWIBTimeRange(
  startsAt?: Date | string | number | null,
  endsAt?: Date | string | number | null
): string {
  if (!startsAt) return '-';
  const startDate = typeof startsAt === 'string' || typeof startsAt === 'number' ? new Date(startsAt) : startsAt;
  if (isNaN(startDate.getTime())) return '-';

  const startTime = formatWIBTime(startDate, false);
  if (!endsAt) return `${startTime} WIB`;

  const endDate = typeof endsAt === 'string' || typeof endsAt === 'number' ? new Date(endsAt) : endsAt;
  if (isNaN(endDate.getTime())) return `${startTime} WIB`;

  const endTime = formatWIBTime(endDate, false);
  return `${startTime}–${endTime} WIB`;
}
