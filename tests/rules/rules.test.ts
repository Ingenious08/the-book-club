/**
 * Security-rules tests. Run with the Firestore emulator:  npm run test:rules
 * (requires Java + firebase-tools; NOT run in the authoring sandbox)
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, setLogLevel, serverTimestamp, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

let env: RulesTestEnvironment;
const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  setLogLevel('error');
  env = await initializeTestEnvironment({
    projectId: 'bookclub-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'books/b1'), { title: 'Build, Don\'t Talk', author: 'Raj Shamani', totalPages: 240, coverImage: null, createdBy: 'alice', createdAt: Timestamp.now(), active: true });
    await setDoc(doc(db, 'clubs/c1'), { name: 'X', bookId: 'b1', createdBy: 'alice', timezone: 'Asia/Kolkata', inviteCode: 'BKCLUB-AAAA', createdAt: Timestamp.now() });
    await setDoc(doc(db, 'clubs/c1/members/alice'), { userId: 'alice', displayName: 'Alice', role: 'admin', joinedAt: Timestamp.now() });
    await setDoc(doc(db, 'clubs/c1/members/bob'), { userId: 'bob', displayName: 'Bob', role: 'member', joinedAt: Timestamp.now() });
    await setDoc(doc(db, 'clubs/c1/entries/2000-01-01_bob'), { userId: 'bob' });
  });
});

const entry = (uid: string, page: number, date = today()) => ({
  userId: uid, clubId: 'c1', bookId: 'b1', displayName: uid, date, pageNumber: page,
  status: 'OPEN_FOR_DISCUSSION', submittedAt: serverTimestamp(), updatedAt: serverTimestamp(),
});

describe('entries', () => {
  it('member can write their own entry', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(db, `clubs/c1/entries/${today()}_alice`), entry('alice', 7)));
  });
  it("member cannot write someone else's entry", async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, `clubs/c1/entries/${today()}_bob`), entry('bob', 7)));
  });
  it('rejects bad page numbers', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, `clubs/c1/entries/${today()}_alice`), entry('alice', 0)));
    await assertFails(setDoc(doc(db, `clubs/c1/entries/${today()}_alice`), entry('alice', 7.5)));
    await assertFails(setDoc(doc(db, `clubs/c1/entries/${today()}_alice`), entry('alice', 241)));
  });
  it('rejects a wrong document id (duplicate-entry trick)', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, `clubs/c1/entries/${today()}_second`), entry('alice', 7)));
  });
  it('rejects dates far from today', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'clubs/c1/entries/2020-01-01_alice'), entry('alice', 7, '2020-01-01')));
  });
  it('unauthenticated cannot read or write', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'clubs/c1/entries/2000-01-01_bob')));
    await assertFails(setDoc(doc(db, `clubs/c1/entries/${today()}_alice`), entry('alice', 7)));
  });
});

describe('clubs', () => {
  it('non-member cannot read a club, its members or entries', async () => {
    const db = env.authenticatedContext('mallory').firestore();
    await assertFails(getDoc(doc(db, 'clubs/c1')));
    await assertFails(getDoc(doc(db, 'clubs/c1/members/alice')));
    await assertFails(getDoc(doc(db, 'clubs/c1/entries/2000-01-01_bob')));
  });
  it('non-member cannot add themselves without an invite', async () => {
    const db = env.authenticatedContext('mallory').firestore();
    await assertFails(setDoc(doc(db, 'clubs/c1/members/mallory'), { userId: 'mallory', displayName: 'M', role: 'member', joinedAt: serverTimestamp() }));
  });
  it('invite holder can join as member but not as admin, and not as someone else', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invites/BKCLUB-AAAA'), { code: 'BKCLUB-AAAA', clubId: 'c1', invitedUserIds: [], active: true });
    });
    const db = env.authenticatedContext('carol').firestore();
    const base = { userId: 'carol', displayName: 'Carol', joinedAt: serverTimestamp(), inviteCode: 'BKCLUB-AAAA' };
    await assertFails(setDoc(doc(db, 'clubs/c1/members/carol'), { ...base, role: 'admin' }));
    await assertFails(setDoc(doc(db, 'clubs/c1/members/dave'), { ...base, role: 'member', userId: 'dave' }));
    await assertSucceeds(setDoc(doc(db, 'clubs/c1/members/carol'), { ...base, role: 'member' }));
  });
});
