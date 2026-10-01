import Link from 'next/link';
import type { Club, ClubMember, ReadingEntry } from '@/types';
import { formatShort } from '@/lib/dates';
import { getDayStatus, groupByDate } from '@/lib/readiness';
import { CheckIcon } from './ui';

/** Rows of past reading days. Used for the 5-day Recent view and the full Logs history. */
export function DayRows({
  entries,
  members,
  tz,
  uid,
  skipDate,
}: {
  entries: ReadingEntry[];
  members: ClubMember[];
  tz: string;
  uid: string;
  skipDate?: string;
}) {
  const days = groupByDate(entries).filter((d) => d.date !== skipDate);
  return (
    <ul>
      {days.map((d) => {
        const status = getDayStatus(d.date, members, entries, tz);
        const order = [...d.entries].sort((a, b) => (a.userId === uid ? -1 : b.userId === uid ? 1 : a.displayName.localeCompare(b.displayName)));
        return (
          <li key={d.date} className="hairline flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">{formatShort(d.date)}</p>
              <p className="mt-1 text-sm text-mute">
                {order.map((e, i) => {
                  const m = members.find((x) => x.userId === e.userId);
                  const name = e.userId === uid ? 'You' : (m?.displayName ?? e.displayName);
                  return (
                    <span key={e.id}>
                      {i > 0 ? ', ' : ''}
                      {name} <span className="text-ink">p. {e.pageNumber}</span>
                    </span>
                  );
                })}
              </p>
            </div>
            {status.discussionReady ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-leaf">
                <CheckIcon size={15} /> Discussion open
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function RecentList({
  club,
  entries,
  members,
  tz,
  uid,
  today,
}: {
  club: Club;
  entries: ReadingEntry[];
  members: ClubMember[];
  tz: string;
  uid: string;
  today: string;
}) {
  // Today is shown in the spread above; Recent is the previous days still inside the 5-day window.
  const hasPast = entries.some((e) => e.date !== today);
  if (!hasPast) return null;
  return (
    <section className="mt-12" aria-labelledby="recent-h">
      <h2 id="recent-h" className="font-serif text-2xl">Recent</h2>
      <div className="mt-3">
        <DayRows entries={entries} members={members} tz={tz} uid={uid} skipDate={today} />
      </div>
      <Link href={`/logs?club=${club.id}`} className="btn-quiet mt-2 inline-flex items-center">
        See all logs
      </Link>
    </section>
  );
}
