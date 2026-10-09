import { toZonedTime, format, formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'Asia/Jakarta';
const OPERATIONAL_DAY_START_HOUR = 6;

/**
 * Returns the current date/time in WIB (Asia/Jakarta)
 */
export function nowWIB(): Date {
  return new Date(); // In Vercel, we will also set TZ=Asia/Jakarta, but this is for reference
}

/**
 * Given a date, return the start of that day in WIB
 */
export function getStartOfDayWIB(dateStr?: string | Date): Date {
  const date = dateStr ? new Date(dateStr) : new Date();
  const zoned = toZonedTime(date, TIMEZONE);
  zoned.setHours(0, 0, 0, 0);
  return zoned; // Returns a Date object that represents 00:00:00 WIB
}

/**
 * Given a date, return the end of that day in WIB
 */
export function getEndOfDayWIB(dateStr?: string | Date): Date {
  const date = dateStr ? new Date(dateStr) : new Date();
  const zoned = toZonedTime(date, TIMEZONE);
  zoned.setHours(23, 59, 59, 999);
  return zoned;
}

export function getOperationalBusinessDate(date: Date = new Date()): Date {
  const [localDate, localHour] = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd HH').split(' ')
  const businessDate = new Date(`${localDate}T00:00:00.000Z`)

  if (Number(localHour) < OPERATIONAL_DAY_START_HOUR) {
    businessDate.setUTCDate(businessDate.getUTCDate() - 1)
  }

  return businessDate
}

/**
 * Format date to WIB string
 */
export function formatWIB(date: Date, formatStr: string = 'yyyy-MM-dd HH:mm:ss'): string {
  const zoned = toZonedTime(date, TIMEZONE);
  return format(zoned, formatStr, { timeZone: TIMEZONE });
}
