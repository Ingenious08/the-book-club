import type { ClubMember, DayStatus, ReadingEntry } from '@/types';
import { dateIdInTz } from './dates';

function joinDate(m: ClubMember, tz: string): string {
  const d = m.joinedAt ? m.joinedAt.toDate() : new Date();
  return dateIdInTz(d, tz);
}

/**
 * Who must read on a given day, and are they all done?
 * Dynamic for any number of members: "all required members have an entry",
 * never "user1 && user2". A club of one is never "ready" (there is no one to talk to).
 */
export function getDayStatus(date: string, members: ClubMember[], entries: ReadingEntry[], tz: string): DayStatus {
  const required = members.filter((m) => joinDate(m, tz) <= date);
  const byUser = new Set(entries.filter((e) => e.date === date).map((e) => e.userId));
  const submitted = required.filter((m) => byUser.has(m.userId));
  const pending = required.filter((m) => !byUser.has(m.userId));
  return {
    date,
    required,
    submitted,
    pending,
    discussionReady: required.length >= 2 && pending.length === 0,
  };
}

export function groupByDate(entries: ReadingEntry[]): Array<{ date: string; entries: ReadingEntry[] }> {
  const map = new Map<string, ReadingEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, entries: list }));
}

export function entryId(date: string, uid: string): string {
  return `${date}_${uid}`;
}
