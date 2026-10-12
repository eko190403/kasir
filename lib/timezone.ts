import { fromZonedTime, format, formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { addDays, subHours } from 'date-fns';

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
  const date = dateStr instanceof Date
    ? formatInTimeZone(dateStr, TIMEZONE, 'yyyy-MM-dd')
    : dateStr ?? formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
  return fromZonedTime(`${date}T${String(OPERATIONAL_DAY_START_HOUR).padStart(2, '0')}:00:00`, TIMEZONE);
}

/**
 * Given a date, return the end of that day in WIB
 */
export function getEndOfDayWIB(dateStr?: string | Date): Date {
  const date = dateStr instanceof Date
    ? formatInTimeZone(dateStr, TIMEZONE, 'yyyy-MM-dd')
    : dateStr ?? formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const nextDate = addDays(new Date(`${date}T00:00:00.000Z`), 1).toISOString().slice(0, 10);
  return new Date(fromZonedTime(`${nextDate}T${String(OPERATIONAL_DAY_START_HOUR).padStart(2, '0')}:00:00`, TIMEZONE).getTime() - 1);
}

export function getOperationalBusinessDate(date: Date = new Date()): Date {
  const localDateTime = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const operationalDate = subHours(new Date(`${localDateTime.replace(' ', 'T')}Z`), OPERATIONAL_DAY_START_HOUR);
  return new Date(`${operationalDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function isTimeWithinRange(time: string, start: string, end: string): boolean {
  const toMinutes = (value: string) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) throw new Error('Jam harus menggunakan format HH:mm.')
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const currentMinutes = toMinutes(time);
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return startMinutes <= endMinutes
    ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
    : currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

export function parseLocalWIBDateTime(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error('Waktu reservasi tidak valid.')
  }
  const date = fromZonedTime(value, TIMEZONE)
  if (!Number.isFinite(date.getTime())) throw new Error('Waktu reservasi tidak valid.')
  return date
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
