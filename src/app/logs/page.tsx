'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useMemberships } from '@/hooks/useMemberships';
import { useClubLive } from '@/hooks/useClubLive';
import { DayRows } from '@/components/RecentList';
import { PageTitle, Skeleton } from '@/components/ui';

export default function LogsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <Logs />
    </Suspense>
  );
}

function Logs() {
  const { uid } = useSession();
  const { memberships, loading } = useMemberships(uid);
  const params = useSearchParams();
  const [picked, setPicked] = useState<string | null>(params.get('club'));
  const clubId = picked && memberships.some((m) => m.clubId === picked) ? picked : memberships[0]?.clubId;

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!clubId) {
    return (
      <div>
        <PageTitle>Reading logs</PageTitle>
        <p className="text-mute">Your reading journey starts here.</p>
      </div>
    );
  }
  return (
    <div>
      <PageTitle>Reading logs</PageTitle>
      {memberships.length > 1 ? <BookTabs clubIds={memberships.map((m) => m.clubId)} active={clubId} onPick={setPicked} /> : null}
      <ClubLog key={clubId} clubId={clubId} />
    </div>
  );
}

function BookTabs({ clubIds, active, onPick }: { clubIds: string[]; active: string; onPick: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Books" className="mb-6 flex gap-2 overflow-x-auto pb-1">
      {clubIds.map((id) => (
        <TabButton key={id} clubId={id} active={id === active} onPick={onPick} />
      ))}
    </div>
  );
}

function TabButton({ clubId, active, onPick }: { clubId: string; active: boolean; onPick: (id: string) => void }) {
  const { book } = useClubLive(clubId, { windowDays: 1 });
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onPick(clubId)}
      className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${active ? 'border-ink bg-ink text-paper' : 'border-line text-mute'}`}
    >
      {book?.title ?? '…'}
    </button>
  );
}

const PAGE = 150;

function ClubLog({ clubId }: { clubId: string }) {
  const { uid } = useSession();
  const [limit, setLimit] = useState(PAGE);
  const { book, members, entries, tz, loading, stale } = useClubLive(clubId, { limitEntries: limit });

  if (loading || !uid) return <Skeleton className="h-40 w-full" />;
  return (
    <section aria-label={book?.title}>
      <h2 className="font-serif text-3xl">{book?.title}</h2>
      {book?.author ? <p className="text-mute">{book.author}</p> : null}
      {stale ? <p role="status" className="mt-3 text-sm text-amber">Connecting… this may be a moment behind.</p> : null}
      {entries.length === 0 ? (
        <p className="mt-6 text-mute">Your reading journey starts here.</p>
      ) : (
        <div className="mt-4">
          <DayRows entries={entries} members={members} tz={tz} uid={uid} />
        </div>
      )}
      {entries.length >= limit ? (
        <button type="button" className="btn-outline mt-4" onClick={() => setLimit((l) => l + PAGE)}>Show older days</button>
      ) : entries.length > 0 ? (
        <p className="mt-6 text-sm text-mute">That&apos;s every day since you started.</p>
      ) : null}
    </section>
  );
}
