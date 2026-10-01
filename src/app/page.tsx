'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useInvitations, useMemberships } from '@/hooks/useMemberships';
import { ClubScreen } from '@/components/ClubScreen';
import { BookCompactCard } from '@/components/BookCompactCard';
import { Skeleton } from '@/components/ui';
import { dateIdInTz, formatLong, greetingFor } from '@/lib/dates';
import { joinClubByCode } from '@/firebase/actions';

export default function Home() {
  const { uid, profile } = useSession();
  const { memberships, loading } = useMemberships(uid);
  const invites = useInvitations(uid, memberships.map((m) => m.clubId));

  if (loading || !profile) {
    return (
      <div role="status" aria-label="Loading">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-10 w-64" />
        <Skeleton className="mt-8 h-24 w-full" />
      </div>
    );
  }

  const now = new Date();
  return (
    <div>
      <Invitations invites={invites} />

      {memberships.length === 0 ? (
        <section className="py-10">
          <p className="text-mute">{formatLong(dateIdInTz(now, profile.timezone))}</p>
          <h1 className="mt-6 font-serif text-5xl leading-[1.02] tracking-tight">Nothing on the reading list yet.</h1>
          <p className="mt-4 text-lg text-mute">Add a book and invite someone to read with you.</p>
          <Link href="/books/new" className="btn-primary mt-8">+ Add Book</Link>
          <p className="mt-6 text-center text-sm text-mute">
            Already have a code? <Link href="/friends" className="underline underline-offset-4">Join a club</Link>
          </p>
        </section>
      ) : memberships.length === 1 ? (
        <ClubScreen key={memberships[0].clubId} clubId={memberships[0].clubId} />
      ) : (
        <>
          <p className="text-mute">{formatLong(dateIdInTz(now, profile.timezone))}</p>
          <h1 className="mt-1 font-serif text-[2.5rem] leading-[1.05] tracking-tight">
            {greetingFor(now, profile.timezone)}, {profile.displayName}.
          </h1>
          <h2 className="mb-1 mt-10 font-serif text-2xl">Your books</h2>
          <ul>
            {memberships.map((m) => (
              <BookCompactCard key={m.clubId} clubId={m.clubId} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Invitations({ invites }: { invites: ReturnType<typeof useInvitations> }) {
  const { uid, profile } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (invites.length === 0 || !uid || !profile) return null;

  return (
    <section className="mb-8 rounded-md border border-line bg-surface px-5 py-5" aria-label="Invitations">
      {invites.map((i) => (
        <div key={i.code} className="flex items-center justify-between gap-4">
          <p className="min-w-0">
            <span className="text-mute">{i.createdByName} invited you to read</span>
            <span className="block truncate font-serif text-2xl">{i.bookTitle}</span>
          </p>
          <button
            type="button"
            className="btn-outline shrink-0"
            disabled={busy === i.code}
            onClick={async () => {
              setBusy(i.code);
              setError(null);
              try {
                const clubId = await joinClubByCode(uid, profile.displayName, i.code);
                router.push(`/club/${clubId}`);
              } catch {
                setError("Couldn't join. Check your connection and try again.");
                setBusy(null);
              }
            }}
          >
            {busy === i.code ? 'Joining…' : 'Join'}
          </button>
        </div>
      ))}
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
