import type { Timestamp } from 'firebase/firestore';

export type ThemePref = 'system' | 'light' | 'dark';

export interface NotificationPrefs {
  /** Architecture-ready: stored, not yet acted on. */
  reminders: boolean;
  partnerReady: boolean;
}

/** users/{uid} */
export interface AppUser {
  id: string;
  displayName: string;
  timezone: string;
  theme: ThemePref;
  notifications: NotificationPrefs;
  createdAt: Timestamp | null;
}

/** books/{bookId} */
export interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number | null;
  coverImage: string | null;
  createdBy: string;
  createdAt: Timestamp | null;
  active: boolean;
}

/** clubs/{clubId}: one club = one book + one group of readers */
export interface Club {
  id: string;
  name: string;
  bookId: string;
  createdBy: string;
  timezone: string;
  inviteCode: string;
  createdAt: Timestamp | null;
}

/** clubs/{clubId}/members/{userId} */
export interface ClubMember {
  id: string;
  userId: string;
  displayName: string;
  role: 'admin' | 'member';
  joinedAt: Timestamp | null;
  inviteCode?: string;
}

/** users/{uid}/memberships/{clubId}: mirror so "my clubs" is one cheap query */
export interface Membership {
  id: string;
  clubId: string;
  bookId: string;
  joinedAt: Timestamp | null;
}

export type EntryStatus = 'OPEN_FOR_DISCUSSION';

/** clubs/{clubId}/entries/{date}_{userId}: one canonical entry per user per day */
export interface ReadingEntry {
  id: string;
  userId: string;
  clubId: string;
  bookId: string;
  displayName: string;
  /** Logical reading day in the club's timezone, e.g. "2026-10-01" */
  date: string;
  pageNumber: number;
  status: EntryStatus;
  submittedAt: Timestamp | null;
  updatedAt: Timestamp | null;
  discussionNote?: string;
}

/** invites/{code} */
export interface Invite {
  id: string;
  code: string;
  clubId: string;
  bookId: string;
  clubName: string;
  bookTitle: string;
  bookAuthor: string;
  createdBy: string;
  createdByName: string;
  invitedUserIds: string[];
  active: boolean;
}

/** Derived (never stored) so it cannot drift out of sync with the entries. */
export interface DayStatus {
  date: string;
  required: ClubMember[];
  submitted: ClubMember[];
  pending: ClubMember[];
  discussionReady: boolean;
}
