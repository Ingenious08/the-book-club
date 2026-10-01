# The Book Club

Read something. Think about it. Talk about it.

A private, mobile-first reading-accountability PWA. Everyone in a book's club enters the last page they finished today and taps **Open for discussion**. When *everyone* has, the app says so, live, on every device.

Stack: Next.js 14 (App Router) · React 18 · TypeScript · Tailwind 3 · Firebase Auth (anonymous) · Cloud Firestore (`onSnapshot` realtime).

---

## 1. Firebase setup (about 10 minutes)

1. **Create a project** at https://console.firebase.google.com → *Add project*. Analytics is not needed.
2. **Authentication** → *Get started* → *Sign-in method*.
3. Enable **Anonymous**.
4. **Firestore Database** → *Create database* → *Production mode*.
5. Pick the region closest to you. For India, `asia-south1` (Mumbai). It can't be changed later.
6. **Project settings (gear) → Your apps → `</>` Web** → register an app (hosting not needed).
7. Copy the `firebaseConfig` values it shows.
8. In this folder: `cp .env.example .env.local` and fill in:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   ```
   (The web API key is not a secret. Security comes from the rules below.)
9. **Deploy the security rules**: either paste `firestore.rules` into *Firestore → Rules → Publish*, or
   `npm i -g firebase-tools && firebase login && firebase use <project-id> && firebase deploy --only firestore`.
10. **First user/book/club**: nothing to create by hand. See §5.

## 2. Run locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # unit tests (dates, day boundaries, readiness logic)
npm run test:rules   # security-rules tests, needs Java + the Firestore emulator
```
To test two people on one machine, use a normal window **and** a private/incognito window (separate anonymous identities). Phones: use your machine's LAN IP, or deploy.

## 3. Deploy

**Vercel (easiest):** push to GitHub → import in Vercel → add the six `NEXT_PUBLIC_FIREBASE_*` variables (+ optional default-book ones) → Deploy. Then in Firebase **Authentication → Settings → Authorized domains**, add your `*.vercel.app` domain.
Env values are baked in at build time, so redeploy after changing them.
Open the site on each phone → Share → *Add to Home Screen*.

---

## 4. Data model

```
users/{uid}                              profile: displayName, timezone, theme, notifications
users/{uid}/memberships/{clubId}         mirror of "clubs I'm in" → home screen = 1 cheap listener
books/{bookId}                           title, author, totalPages|null, coverImage|null, createdBy, active
clubs/{clubId}                           name, bookId, createdBy, timezone, inviteCode
clubs/{clubId}/members/{userId}          displayName, role (admin|member), joinedAt   ← authoritative membership
clubs/{clubId}/entries/{date}_{userId}   one canonical entry per user per day
invites/{code}                           BKCLUB-XXXX → clubId (+ names for the join screen, invitedUserIds)
```

Deliberate improvements over the sketch in the spec:

* **Flat `entries` collection** instead of `readingDays/{date}/entries/{uid}`. One query (`date >= today-4`, newest first) returns the whole 5-day window for a club, one listener instead of five. The doc id `2026-10-01_<uid>` makes "one entry per user per day" structurally impossible to violate.
* **`discussionReady` is derived, never stored** (`src/lib/readiness.ts`): it's true when every required member has an entry for that date, and there are ≥ 2 members. A stored flag could drift out of sync with the entries; a derived one can't.
* **`memberships` mirror** avoids a collection-group query/index.

Example documents:

```jsonc
// clubs/Kq3…/entries/2026-10-01_Zx9…
{ "userId":"Zx9…", "clubId":"Kq3…", "bookId":"Bk1…", "displayName":"Aagam",
  "date":"2026-10-01", "pageNumber":7, "status":"OPEN_FOR_DISCUSSION",
  "submittedAt":"<server ts>", "updatedAt":"<server ts>", "discussionNote":"optional" }

// clubs/Kq3…/members/Zx9…
{ "userId":"Zx9…", "displayName":"Aagam", "role":"admin", "joinedAt":"<server ts>" }

// invites/BKCLUB-7X92
{ "code":"BKCLUB-7X92", "clubId":"Kq3…", "bookTitle":"Build, Don't Talk", "bookAuthor":"Raj Shamani",
  "createdByName":"Aagam", "invitedUserIds":[], "active":true }
```

**What you'll see in the Firebase Console**
* *Authentication → Users*: one anonymous row per device/browser (the UID is the identity).
* *Firestore → users, books, clubs (→ members, entries), invites*, as above. Watch `entries` fill in as you tap the button.

## 5. First-time flow (no manual Firebase editing)

1. **You** open the app → name → welcome sequence. If `NEXT_PUBLIC_DEFAULT_BOOK_TITLE/AUTHOR` are set (they are in `.env.example`), the app creates *Build, Don't Talk* + its club through the normal code path and shows "Added to Build, Don't Talk". Nothing is hardcoded in screens.
2. Home shows an **invite card** ("Read with someone", code `BKCLUB-XXXX` + share link).
3. **Your friend opens your link** (`/join/BKCLUB-XXXX`), enters their name, taps **Join the club**. Both of you now appear as members.
   ⚠️ Your friend should open the *link*. If they open the bare site URL they'll get their own default-book club. (Leave the default-book env vars blank to avoid that entirely, then use Add Book.)

## 6. How two devices stay in sync

* Each club screen subscribes (`src/hooks/useClubLive.ts`) to four scoped listeners: the club doc, its book, its `members`, and its `entries` for the 5-day window. Nothing else is listened to; all unsubscribe on unmount.
* Tapping **Open for discussion** runs a Firestore **transaction** on `entries/{today}_{uid}`. It resolves only after the server commits. The button turns green only then, so the app never shows "ready" for an unconfirmed write. Failure shows: *"Couldn't save your progress. Check your connection and try again."*
* Firestore pushes the new doc to every listening device; each re-derives readiness from `members` + `entries`. No polling, no refresh.
* Offline persistence is deliberately **off** (memory cache). A "Connecting…" / "You're offline" note appears when the feed is stale.

## 7. Dates & the 11:59 PM deadline

* The "reading day" is a string (`2026-10-01`) computed in the **club's timezone** (default `Asia/Kolkata`) via `Intl`, never from UTC. `submittedAt` is a server timestamp, stored separately.
* The day ends at midnight, so 11:59:59 PM still counts and 12:00 AM is a new day. The screen re-checks every 15 s and on focus. No manual reset; listeners re-scope automatically.
* Rules can't know timezones, so they accept an entry date within ±1 UTC day of the server clock (covers every timezone) and reject anything else. See Limitations.

## 8. Recent vs. history

* **Home/Club "Recent"** queries only entries with `date >= today − 4`, i.e. the last five calendar days. On Oct 2, Sep 27 simply falls outside the query.
* **Logs** queries newest-first with a growing limit ("Show older days").
* Nothing is ever deleted: rules set `allow delete: if false` on entries.

## 9. Add a second book / another friend

* **Menu → Add Book**: title, author, optional pages & cover link, then tick who's reading. Each book gets its **own club** (members, entries, history, invite code). Reading Book A never touches Book B. With 2+ books, Home becomes "Your books".
* **Menu → Add Friend**: pick the book → share its code/link. People you already read with can be invited to this book in one tap (they see an invitation on their Home). Joining is per club; a friend only ever sees the books they've joined.
* With 3+ members the UI says "Everyone's ready" and unlocks only when all have submitted.

## 10. Security rules (summary: `firestore.rules`)

Default deny. Members read their club, members and entries only. You can only write **your own** entry; its id must equal `<date>_<your uid>`; page must be an integer > 0 (and ≤ the book's total pages if known); `submittedAt/updatedAt` must equal server time; no deletes. Joining requires a valid active invite for that club and only adds yourself as `member`; admin role only on club creation. Only admins edit club timezone/invites.

---

## 11. QA checklist

Verified in the authoring sandbox ✅ / needs you ☐

- ✅ `tsc --noEmit` clean, `next build` succeeds, 15 unit tests pass (11:58 / 11:59 PM / 12:00 AM IST, UTC-vs-IST, month/year/leap rollovers, 2- and 3-member readiness, yesterday doesn't unlock today, solo club never ready, late joiners, page & invite parsing).
- ☐ **Realtime** (two windows): A submits → B shows it without refresh; B submits → A flips to *Both of you are ready* and the gutter turns green.
- ☐ Edit page 7 → 9 keeps one doc (`entries` shows a single `…_uid` doc, `updatedAt` changes).
- ☐ Refresh and close/reopen: state returns from Firestore.
- ☐ Two books, two different friends: no cross-visibility.
- ☐ 3 members: locked until the third submits.
- ☐ Set the device clock/timezone near midnight, or temporarily change the club timezone in Settings, to watch rollover.
- ☐ DevTools → Network → Offline: banner appears; tapping the button shows the save error and nothing turns green.
- ☐ `npm run test:rules` (emulator): non-member read denied, writing another user's entry denied, page 0 / 7.5 / > totalPages denied, wrong doc id denied, unauthenticated denied, invite-only join.
- ☐ Screens at 320, 375, 430 px, iPad, desktop; keyboard-only pass.

> Honest scope note: I could not connect to a real Firebase project, run the Firestore emulator, or take browser screenshots from the sandbox. The realtime path, security-rules tests and visual polish above are written to spec but **not exercised yet**. Please run the ☐ items; the rules are the first thing I'd test.

## 12. Known limitations

* **Anonymous identity is per browser.** Clearing site data (or switching browser) creates a new user. Fix later: `linkWithPopup(auth.currentUser, new GoogleAuthProvider())` upgrades the *same* UID, so nothing is lost. The data model already supports it.
* Rules enforce *approximate* date validity (±1 UTC day), not the exact club-timezone 11:59 PM cutoff. Exact server-side enforcement needs a Cloud Function (not added to keep Version 1 light). In a friends-only club the practical risk is nil.
* Any signed-in user who knows a book's random id can read its title/author (needed because clubs can't be reverse-looked-up in rules). Club data itself is member-only.
* Cover images are a pasted `https://` link (no Storage upload yet).
* Notification prefs are stored but no push is sent yet. FCM + a scheduled Cloud Function slot in without data changes.
* Admins can't leave while other members remain; no admin hand-over UI yet.

## 13. Project structure

```
src/app/          routes: / · /club/[clubId] · /books · /books/new · /logs · /friends · /settings · /join/[code]
src/components/   AppShell, Onboarding, ClubScreen, Spread, DiscussionCard, RecentList, …
src/hooks/        useSession (anon auth + profile), useClubLive (scoped listeners), useMemberships, useToday
src/firebase/     client.ts (lazy init), actions.ts (all writes)
src/lib/          dates.ts (timezone-safe day ids), readiness.ts (derived state)
src/types/        User, Book, Club, ClubMember, ReadingEntry, Invite, …
firestore.rules · firestore.indexes.json (none needed) · firebase.json
```

Future-ready (no schema changes needed): streaks and totals derive from `entries`; notes already live on the entry; push reminders; book completion via `books.active`.
