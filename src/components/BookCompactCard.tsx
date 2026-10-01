'use client';

import Link from 'next/link';
import { useClubLive } from '@/hooks/useClubLive';
import { useSession } from '@/hooks/useSession';
import { entryId, getDayStatus } from '@/lib/readiness';
import { listNames } from '@/utils/text';
import { CheckIcon, RingIcon, Skeleton } from './ui';

/** Minimal book row for the multi-book home screen. */
export function BookCompactCard({ clubId }: { clubId: string }) {
  const { uid } = useSession();
  const { club, book, members, entries, today, tz, loading, notFound } = useClubLive(clubId, { windowDays: 1 });

  if (loading) return <Skeleton className="my-4 h-24 w-full" />;
  if (notFound || !club || !book || !uid) return null;

  const status = getDayStatus(today, members, entries, tz);
  const mine = entries.find((e) => e.id === entryId(today, uid));
  const waitingOn = status.pending.filter((m) => m.userId !== uid).map((m) => m.displayName);

  let line: string;
  if (status.discussionReady && mine) line = 'Discussion open';
  else if (mine) line = waitingOn.length ? `Waiting for ${listNames(waitingOn)}` : 'Invite a friend to read along';
  else line = 'Not read yet today';

  return (
    <li className="hairline">
      <Link href={`/club/${club.id}`} className="flex items-center justify-between gap-4 py-5">
        <div className="min-w-0">
          <p className="truncate font-serif text-[1.75rem] leading-tight">{book.title}</p>
          <p className="truncate text-mute">{book.author}</p>
          <p className={`mt-2 inline-flex items-center gap-1.5 text-sm ${mine ? 'text-leaf' : 'text-amber'}`}>
            {mine ? <CheckIcon size={15} /> : <RingIcon size={15} />}
            {mine ? `Page ${mine.pageNumber}. ` : ''}
            {line}
          </p>
        </div>
      </Link>
    </li>
  );
}
