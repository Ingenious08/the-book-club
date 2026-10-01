import { describe, expect, it } from 'vitest';
import { addDays, dateIdInTz, formatShort, secondsLeftToday } from '../../src/lib/dates';
import { getDayStatus } from '../../src/lib/readiness';
import { normalizeInviteCode, parsePage } from '../../src/utils/text';
import type { ClubMember, ReadingEntry } from '../../src/types';

const IST = 'Asia/Kolkata';

describe('day boundaries (Asia/Kolkata = UTC+5:30)', () => {
  it('11:58 PM IST is still Oct 1', () => {
    expect(dateIdInTz(new Date('2026-10-01T18:28:00Z'), IST)).toBe('2026-10-01'); // 23:58 IST
  });
  it('11:59 PM IST is still Oct 1', () => {
    expect(dateIdInTz(new Date('2026-10-01T18:29:00Z'), IST)).toBe('2026-10-01');
  });
  it('12:00 AM IST is Oct 2 (UTC is still Oct 1)', () => {
    expect(dateIdInTz(new Date('2026-10-01T18:30:00Z'), IST)).toBe('2026-10-02');
    expect(new Date('2026-10-01T18:30:00Z').toISOString().slice(0, 10)).toBe('2026-10-01');
  });
  it('UTC-evening is already tomorrow in India', () => {
    expect(dateIdInTz(new Date('2026-10-01T20:00:00Z'), IST)).toBe('2026-10-02');
  });
  it('the same instant is different days in different timezones', () => {
    const t = new Date('2026-10-01T22:00:00Z');
    expect(dateIdInTz(t, 'America/Los_Angeles')).toBe('2026-10-01');
    expect(dateIdInTz(t, IST)).toBe('2026-10-02');
  });
  it('seconds left at 11:59:00 PM is 60', () => {
    expect(secondsLeftToday(new Date('2026-10-01T18:29:00Z'), IST)).toBe(60);
  });
  it('addDays crosses month/year/leap boundaries', () => {
    expect(addDays('2026-10-01', 1)).toBe('2026-10-02');
    expect(addDays('2026-10-01', -4)).toBe('2026-09-27');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('formats short dates', () => expect(formatShort('2026-09-27')).toBe('Sep 27'));
});

const ts = (iso: string) => ({ toDate: () => new Date(iso) }) as unknown as ClubMember['joinedAt'];
const member = (id: string, joined = '2026-09-01T00:00:00Z'): ClubMember => ({ id, userId: id, displayName: id, role: 'member', joinedAt: ts(joined) });
const entry = (uid: string, date: string, page = 5): ReadingEntry => ({
  id: `${date}_${uid}`, userId: uid, clubId: 'c', bookId: 'b', displayName: uid, date, pageNumber: page,
  status: 'OPEN_FOR_DISCUSSION', submittedAt: null, updatedAt: null,
});

describe('discussion readiness (dynamic membership)', () => {
  it('two members: locked until both submit', () => {
    const m = [member('a'), member('b')];
    expect(getDayStatus('2026-10-01', m, [entry('a', '2026-10-01')], IST).discussionReady).toBe(false);
    expect(getDayStatus('2026-10-01', m, [entry('a', '2026-10-01'), entry('b', '2026-10-01')], IST).discussionReady).toBe(true);
  });
  it('three members: needs all three', () => {
    const m = [member('a'), member('b'), member('c')];
    const two = [entry('a', '2026-10-01'), entry('b', '2026-10-01')];
    expect(getDayStatus('2026-10-01', m, two, IST).discussionReady).toBe(false);
    expect(getDayStatus('2026-10-01', m, [...two, entry('c', '2026-10-01')], IST).discussionReady).toBe(true);
  });
  it("yesterday's entries don't unlock today", () => {
    const m = [member('a'), member('b')];
    const es = [entry('a', '2026-09-30'), entry('b', '2026-09-30'), entry('a', '2026-10-01')];
    expect(getDayStatus('2026-10-01', m, es, IST).discussionReady).toBe(false);
  });
  it('a solo club is never "ready"', () => {
    expect(getDayStatus('2026-10-01', [member('a')], [entry('a', '2026-10-01')], IST).discussionReady).toBe(false);
  });
  it('a member who joined later is not required for earlier days', () => {
    const m = [member('a'), member('b', '2026-10-01T06:00:00Z')];
    expect(getDayStatus('2026-09-30', m, [entry('a', '2026-09-30')], IST).required).toHaveLength(1);
  });
});

describe('input helpers', () => {
  it('parsePage accepts only positive whole numbers', () => {
    expect(parsePage('7')).toBe(7);
    expect(parsePage('0')).toBeNull();
    expect(parsePage('-3')).toBeNull();
    expect(parsePage('7.5')).toBeNull();
    expect(parsePage('')).toBeNull();
    expect(parsePage('123456')).toBeNull();
  });
  it('normalizes invite codes', () => {
    expect(normalizeInviteCode(' bkclub-7x92 ')).toBe('BKCLUB-7X92');
    expect(normalizeInviteCode('7x92')).toBe('BKCLUB-7X92');
  });
});
