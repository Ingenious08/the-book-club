'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useClubLive } from '@/hooks/useClubLive';
import { submitPage } from '@/firebase/actions';
import { formatLong, formatTimeLeft, greetingFor } from '@/lib/dates';
import { entryId, getDayStatus } from '@/lib/readiness';
import { listNames, parsePage } from '@/utils/text';
import { Spread, type Page } from './Spread';
import { DiscussionCard } from './DiscussionCard';
import { RecentList } from './RecentList';
import { ConnectionBanner } from './ConnectionBanner';
import { InviteShare } from './InviteShare';
import { CheckIcon, ErrorNote, Skeleton } from './ui';

export function ClubScreen({ clubId, showGreeting = true }: { clubId: string; showGreeting?: boolean }) {
  const { uid, profile } = useSession();
  const live = useClubLive(clubId, { windowDays: 5 });
  const { club, book, members, entries, today, secondsLeft, tz, loading, notFound, stale } = live;

  const [raw, setRaw] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ date: string; page: number } | null>(null);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const wasReady = useRef<boolean | null>(null);

  const status = getDayStatus(today, members, entries, tz);
  const myEntry = entries.find((e) => e.id === entryId(today, uid ?? ''));
  const myPage = myEntry?.pageNumber ?? (confirmed?.date === today ? confirmed.page : null);
  const iAmReady = myPage !== null;
  const ready = status.discussionReady && iAmReady;

  // Sub-second "both ready" moment: only animate when it flips live, not on first load.
  const [justBecameReady, setJustBecameReady] = useState(false);
  useEffect(() => {
    if (loading) return;
    if (wasReady.current === false && ready) setJustBecameReady(true);
    wasReady.current = ready;
  }, [ready, loading]);

  // New day: reset the local, per-day UI state.
  useEffect(() => {
    setEditing(false);
    setRaw('');
    setDiscussionOpen(false);
    setJustBecameReady(false);
    setError(null);
  }, [today]);

  if (loading) return <TodaySkeleton />;
  if (notFound || !club || !book || !uid || !profile) {
    return (
      <div className="py-10">
        <h1 className="font-serif text-3xl">We couldn&apos;t find this book.</h1>
        <p className="mt-2 text-mute">You may have left this club, or the link is out of date.</p>
      </div>
    );
  }

  const others = members.filter((m) => m.userId !== uid);
  const pendingOthers = status.pending.filter((m) => m.userId !== uid);
  const showEditor = !iAmReady || editing;
  const parsed = parsePage(raw);
  const tooHigh = !!(book.totalPages && parsed && parsed > book.totalPages);
  const everyone = members.length > 2;

  const pages: Page[] = [
    { userId: uid, name: profile.displayName, isMe: true, page: showEditor ? null : myPage, ready: iAmReady },
    ...others.map((m) => {
      const e = entries.find((x) => x.id === entryId(today, m.userId));
      return { userId: m.userId, name: m.displayName, isMe: false, page: e?.pageNumber ?? null, ready: !!e };
    }),
  ];
  // While editing an existing page, still show the saved ready state for me.
  if (editing && myPage !== null) pages[0] = { ...pages[0], page: null, ready: true };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed || tooHigh || saving || !club || !book || !uid || !profile) return;
    setSaving(true);
    setError(null);
    try {
      await submitPage({ clubId: club.id, bookId: book.id, uid, displayName: profile.displayName, date: today, pageNumber: parsed });
      setConfirmed({ date: today, page: parsed });
      setEditing(false);
      setRaw('');
    } catch {
      setError("Couldn't save your progress. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const headline = ready
    ? everyone ? "Everyone's ready." : 'Both of you are ready.'
    : iAmReady
      ? "You're ready."
      : status.submitted.length > 0
        ? `${listNames(status.submitted.filter((m) => m.userId !== uid).map((m) => m.displayName))} ${status.submitted.length === 1 ? 'is' : 'are'} ready. Your turn.`
        : 'Read a little. Then tell us how far you got.';

  const subline = ready
    ? everyone ? 'You all showed up today. Now talk about it.' : 'You both showed up today. Now talk about it.'
    : iAmReady
      ? pendingOthers.length > 0 ? `Waiting for ${listNames(pendingOthers.map((m) => m.displayName))}.` : others.length === 0 ? 'Invite a friend so there is someone to talk to.' : ''
      : '';

  return (
    <div>
      <ConnectionBanner stale={stale} />

      <p className="text-mute">{formatLong(today)}</p>
      {showGreeting ? (
        <h1 className="mt-1 font-serif text-[2.5rem] leading-[1.05] tracking-tight">
          {greetingFor(new Date(), tz)}, {profile.displayName}.
        </h1>
      ) : null}

      <div className="mt-8">
        <h2 className="font-serif text-[2rem] leading-tight">{book.title}</h2>
        {book.author ? <p className="text-mute">{book.author}</p> : null}
      </div>

      <form onSubmit={onSubmit} className="mt-6" aria-busy={saving}>
        <Spread
          pages={pages}
          totalPages={book.totalPages}
          allReady={ready}
          celebrate={justBecameReady}
          editor={
            showEditor ? (
              <>
                <label htmlFor="page" className="sr-only">The last page you finished reading</label>
                <input
                  id="page"
                  className="numeral numeral-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder={myPage ? String(myPage) : '0'}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value.replace(/\D/g, ''))}
                  autoFocus={editing}
                  aria-invalid={tooHigh}
                />
              </>
            ) : undefined
          }
        />

        {tooHigh ? <ErrorNote>This book has {book.totalPages} pages. Check the number.</ErrorNote> : null}

        <div className="mt-4">
          {showEditor ? (
            <button type="submit" className="btn-primary" disabled={!parsed || tooHigh || saving}>
              {saving ? 'Saving…' : editing ? 'Update page' : 'Open for discussion'}
            </button>
          ) : (
            <>
              <button type="button" className="btn-primary" data-state="done" disabled aria-pressed="true">
                <CheckIcon animate size={20} /> Open for discussion
              </button>
              <div className="mt-1 flex justify-center">
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => {
                    setRaw('');
                    setEditing(true);
                  }}
                >
                  Change page
                </button>
              </div>
            </>
          )}
          {editing ? (
            <div className="mt-1 flex justify-center">
              <button type="button" className="btn-quiet" onClick={() => { setEditing(false); setRaw(''); setError(null); }}>
                Cancel
              </button>
            </div>
          ) : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </div>
      </form>

      <section aria-live="polite" className={`mt-8 ${justBecameReady ? 'fade-in' : ''}`}>
        <h2 className={`font-serif text-[1.75rem] leading-tight ${ready ? 'text-leaf' : ''}`}>{headline}</h2>
        {subline ? <p className="mt-1 text-mute">{subline}</p> : null}
        {!ready ? (
          <p className="mt-3 text-sm text-mute">
            Today closes at 11:59 PM{secondsLeft <= 3 * 3600 ? `, ${formatTimeLeft(secondsLeft)}` : ''}.
          </p>
        ) : null}
      </section>

      {members.length === 1 ? (
        <section className="mt-6 rounded-md border border-line bg-surface px-5 py-5">
          <h2 className="font-serif text-2xl">Read with someone.</h2>
          <p className="mb-4 mt-1 text-sm text-mute">Send them this and they&apos;re in.</p>
          <InviteShare code={club.inviteCode} bookTitle={book.title} />
        </section>
      ) : null}

      {ready ? (
        discussionOpen ? (
          <DiscussionCard
            clubId={club.id}
            uid={uid}
            date={today}
            myNote={myEntry?.discussionNote ?? ''}
            others={others.map((m) => ({ name: m.displayName, entry: entries.find((x) => x.id === entryId(today, m.userId)) }))}
          />
        ) : (
          <button type="button" className="btn-outline mt-5 w-full" onClick={() => setDiscussionOpen(true)}>
            Start discussion
          </button>
        )
      ) : null}

      <RecentList club={club} entries={entries} members={members} tz={tz} uid={uid} today={today} />
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div role="status" aria-label="Loading today's reading">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-10 w-64" />
      <Skeleton className="mt-8 h-8 w-56" />
      <Skeleton className="mt-6 h-52 w-full" />
      <Skeleton className="mt-4 h-14 w-full" />
      <p className="mt-4 text-sm text-mute">Loading today&apos;s reading…</p>
    </div>
  );
}
