import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { getFirebase } from './client';
import type { Invite, ThemePref, NotificationPrefs } from '@/types';
import { randomInviteCode, withTimeout } from '@/utils/text';
import { entryId } from '@/lib/readiness';

/* ---------- profile ---------- */

export async function createProfile(uid: string, displayName: string, timezone: string) {
  const { db } = getFirebase();
  await setDoc(doc(db, 'users', uid), {
    displayName: displayName.trim(),
    timezone,
    theme: 'system' satisfies ThemePref,
    notifications: { reminders: false, partnerReady: false } satisfies NotificationPrefs,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProfile(
  uid: string,
  patch: Partial<{ timezone: string; theme: ThemePref; notifications: NotificationPrefs }>,
) {
  const { db } = getFirebase();
  await updateDoc(doc(db, 'users', uid), { ...patch, updatedAt: serverTimestamp() });
}

/** Rename everywhere the name is shown: profile + each club's member doc. */
export async function renameUser(uid: string, displayName: string, clubIds: string[]) {
  const { db } = getFirebase();
  const name = displayName.trim();
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { displayName: name, updatedAt: serverTimestamp() });
  for (const clubId of clubIds) batch.update(doc(db, 'clubs', clubId, 'members', uid), { displayName: name });
  await batch.commit();
}

/* ---------- books & clubs ---------- */

async function uniqueInviteCode(db: Firestore): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = randomInviteCode();
    const snap = await getDoc(doc(db, 'invites', code));
    if (!snap.exists()) return code;
  }
  throw new Error('Could not generate an invite code');
}

export interface NewBookInput {
  uid: string;
  displayName: string;
  title: string;
  author: string;
  totalPages: number | null;
  coverImage: string | null;
  timezone: string;
  invitedUserIds: string[];
}

/** One atomic batch: book + club + creator membership + mirror + invite. */
export async function createBookAndClub(p: NewBookInput) {
  const { db } = getFirebase();
  const bookRef = doc(collection(db, 'books'));
  const clubRef = doc(collection(db, 'clubs'));
  const code = await uniqueInviteCode(db);
  const title = p.title.trim();
  const author = p.author.trim();

  const batch = writeBatch(db);
  batch.set(bookRef, {
    title,
    author,
    totalPages: p.totalPages,
    coverImage: p.coverImage,
    createdBy: p.uid,
    createdAt: serverTimestamp(),
    active: true,
  });
  batch.set(clubRef, {
    name: `${title} Club`,
    bookId: bookRef.id,
    createdBy: p.uid,
    timezone: p.timezone,
    inviteCode: code,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'clubs', clubRef.id, 'members', p.uid), {
    userId: p.uid,
    displayName: p.displayName,
    role: 'admin',
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'users', p.uid, 'memberships', clubRef.id), {
    clubId: clubRef.id,
    bookId: bookRef.id,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'invites', code), {
    code,
    clubId: clubRef.id,
    bookId: bookRef.id,
    clubName: `${title} Club`,
    bookTitle: title,
    bookAuthor: author,
    createdBy: p.uid,
    createdByName: p.displayName,
    invitedUserIds: p.invitedUserIds,
    active: true,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { clubId: clubRef.id, bookId: bookRef.id, code };
}

export async function getInvite(code: string): Promise<Invite | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'invites', code));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Invite) : null;
}

export async function joinClubByCode(uid: string, displayName: string, code: string): Promise<string> {
  const { db } = getFirebase();
  const invite = await getInvite(code);
  if (!invite || !invite.active) throw new Error('INVITE_INVALID');

  const mirror = await getDoc(doc(db, 'users', uid, 'memberships', invite.clubId));
  if (mirror.exists()) return invite.clubId; // already in

  const batch = writeBatch(db);
  batch.set(doc(db, 'clubs', invite.clubId, 'members', uid), {
    userId: uid,
    displayName,
    role: 'member',
    joinedAt: serverTimestamp(),
    inviteCode: code,
  });
  batch.set(doc(db, 'users', uid, 'memberships', invite.clubId), {
    clubId: invite.clubId,
    bookId: invite.bookId,
    joinedAt: serverTimestamp(),
  });
  await batch.commit();
  return invite.clubId;
}

export async function inviteExistingFriends(code: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const { db } = getFirebase();
  await updateDoc(doc(db, 'invites', code), { invitedUserIds: arrayUnion(...userIds) });
}

export async function leaveClub(uid: string, clubId: string) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'clubs', clubId, 'members', uid));
  batch.delete(doc(db, 'users', uid, 'memberships', clubId));
  await batch.commit();
}

export async function setClubTimezone(clubId: string, timezone: string) {
  const { db } = getFirebase();
  await updateDoc(doc(db, 'clubs', clubId), { timezone });
}

export async function fetchMembers(clubId: string) {
  const { db } = getFirebase();
  const snap = await getDocs(collection(db, 'clubs', clubId, 'members'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as { id: string; userId: string; displayName: string });
}

/* ---------- reading ---------- */

export interface SubmitPageInput {
  clubId: string;
  bookId: string;
  uid: string;
  displayName: string;
  date: string;
  pageNumber: number;
}

/**
 * Create-or-update today's single canonical entry (id = `${date}_${uid}`).
 * Runs as a transaction so it only resolves once the SERVER has committed;
 * the UI never shows "ready" for a write that hasn't been confirmed.
 */
export async function submitPage(p: SubmitPageInput) {
  const { db } = getFirebase();
  const ref = doc(db, 'clubs', p.clubId, 'entries', entryId(p.date, p.uid));
  await withTimeout(
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        tx.update(ref, { pageNumber: p.pageNumber, displayName: p.displayName, updatedAt: serverTimestamp() });
      } else {
        tx.set(ref, {
          userId: p.uid,
          clubId: p.clubId,
          bookId: p.bookId,
          displayName: p.displayName,
          date: p.date,
          pageNumber: p.pageNumber,
          status: 'OPEN_FOR_DISCUSSION',
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }),
  );
}

export async function saveDiscussionNote(clubId: string, uid: string, date: string, note: string) {
  const { db } = getFirebase();
  const ref = doc(db, 'clubs', clubId, 'entries', entryId(date, uid));
  await withTimeout(
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('NO_ENTRY');
      tx.update(ref, { discussionNote: note.trim().slice(0, 1000), updatedAt: serverTimestamp() });
    }),
  );
}
