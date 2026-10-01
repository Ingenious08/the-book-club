'use client';

import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where, type DocumentData, type QueryConstraint } from 'firebase/firestore';
import { getFirebase } from '@/firebase/client';
import { addDays, DEFAULT_TIMEZONE } from '@/lib/dates';
import { useToday } from './useToday';
import type { Book, Club, ClubMember, ReadingEntry } from '@/types';

function withId<T>(d: { id: string; data: () => DocumentData }): T {
  return { id: d.id, ...d.data() } as T;
}

interface Options {
  /** Only entries from the last N calendar days (incl. today). */
  windowDays?: number;
  /** Or: newest N entries, for the history screen. */
  limitEntries?: number;
}

/**
 * Realtime listeners scoped to ONE club:
 *   clubs/{clubId}, books/{bookId}, clubs/{clubId}/members, clubs/{clubId}/entries (date-bounded)
 * All are unsubscribed on unmount. The entries query resubscribes automatically when the
 * window start changes (i.e. at midnight in the club's timezone).
 */
export function useClubLive(clubId: string, opts: Options) {
  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [book, setBook] = useState<Book | null | undefined>(undefined);
  const [members, setMembers] = useState<ClubMember[] | undefined>(undefined);
  const [entries, setEntries] = useState<ReadingEntry[] | undefined>(undefined);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tz = club?.timezone || DEFAULT_TIMEZONE;
  const { today, secondsLeft } = useToday(tz);
  const windowStart = opts.windowDays ? addDays(today, 1 - opts.windowDays) : null;
  const limitEntries = opts.limitEntries ?? null;
  const clubReady = !!club;
  const bookId = club?.bookId;

  useEffect(() => {
    const { db } = getFirebase();
    return onSnapshot(
      doc(db, 'clubs', clubId),
      (snap) => setClub(snap.exists() ? withId<Club>(snap) : null),
      // Not a member / doesn't exist: treat the same, never leak which.
      () => setClub(null),
    );
  }, [clubId]);

  useEffect(() => {
    if (!bookId) return;
    const { db } = getFirebase();
    return onSnapshot(
      doc(db, 'books', bookId),
      (snap) => setBook(snap.exists() ? withId<Book>(snap) : null),
      (e) => setError(e.message),
    );
  }, [bookId]);

  useEffect(() => {
    if (!clubReady) return;
    const { db } = getFirebase();
    return onSnapshot(
      collection(db, 'clubs', clubId, 'members'),
      (snap) => setMembers(snap.docs.map((d) => withId<ClubMember>(d))),
      (e) => setError(e.message),
    );
  }, [clubId, clubReady]);

  useEffect(() => {
    if (!clubReady) return;
    const { db } = getFirebase();
    const constraints: QueryConstraint[] = [];
    if (windowStart) constraints.push(where('date', '>=', windowStart));
    constraints.push(orderBy('date', 'desc'));
    if (limitEntries) constraints.push(limit(limitEntries));
    return onSnapshot(
      query(collection(db, 'clubs', clubId, 'entries'), ...constraints),
      (snap) => {
        setEntries(snap.docs.map((d) => withId<ReadingEntry>(d)));
        setFromCache(snap.metadata.fromCache);
      },
      (e) => setError(e.message),
    );
  }, [clubId, clubReady, windowStart, limitEntries]);

  const loading = club === undefined || (club !== null && (book === undefined || members === undefined || entries === undefined) && !error);

  return {
    club,
    book,
    members: members ?? [],
    entries: entries ?? [],
    today,
    secondsLeft,
    tz,
    loading,
    notFound: club === null,
    /** true when the latest snapshot came from cache: connection is down or still connecting */
    stale: fromCache,
    error,
  };
}
