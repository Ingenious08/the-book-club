export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function safeTimezone(tz: string | undefined | null): string {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function zonedParts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return {
    year: Number(o.year),
    month: Number(o.month),
    day: Number(o.day),
    hour: Number(o.hour) % 24,
    minute: Number(o.minute),
    second: Number(o.second),
  };
}

/** Deterministic logical day id ("2026-10-01") in the given timezone. */
export function dateIdInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Seconds until the day rolls over (00:00:00) in tz. The 11:59 PM deadline is the end of this day. */
export function secondsLeftToday(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  return 86400 - (p.hour * 3600 + p.minute * 60 + p.second);
}

export function addDays(dateId: string, n: number): string {
  const [y, m, d] = dateId.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function utcDate(dateId: string): Date {
  const [y, m, d] = dateId.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatLong(dateId: string): string {
  return utcDate(dateId).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatShort(dateId: string): string {
  return utcDate(dateId).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function greetingFor(date: Date, tz: string): string {
  const h = zonedParts(date, tz).hour;
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatTimeLeft(seconds: number): string {
  const mins = Math.max(1, Math.ceil(seconds / 60));
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} left`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hour${h === 1 ? '' : 's'} left` : `${h}h ${m}m left`;
}

export function commonTimezones(): string[] {
  return [
    'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
    'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago',
    'America/Denver', 'America/Los_Angeles', 'UTC',
  ];
}
