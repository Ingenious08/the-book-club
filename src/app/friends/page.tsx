'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useFriends, useMemberships } from '@/hooks/useMemberships';
import { useClubLive } from '@/hooks/useClubLive';
import { inviteExistingFriends } from '@/firebase/actions';
import { InviteShare } from '@/components/InviteShare';
import { ErrorNote, PageTitle, Skeleton } from '@/components/ui';
import { normalizeInviteCode } from '@/utils/text';
import { CheckIcon } from '@/components/ui';

export default function AddFriend() {
  const { uid } = useSession();
  const { memberships, loading } = useMemberships(uid);
  const [picked, setPicked] = useState<string | null>(null);
  const clubId = picked && memberships.some((m) => m.clubId === picked) ? picked : memberships[0]?.clubId;

  return (
    <div>
      <PageTitle sub="Invites belong to a book, so a friend only sees what you share with them.">Add a friend</PageTitle>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : clubId ? (
        <ClubInvite key={clubId} clubId={clubId} allClubIds={memberships.map((m) => m.clubId)} onPick={setPicked} />
      ) : (
        <p className="mb-10 text-mute">Add a book first, then you can invite someone to read it with you.</p>
      )}
      <JoinWithCode />
    </div>
  );
}

function ClubInvite({ clubId, allClubIds, onPick }: { clubId: string; allClubIds: string[]; onPick: (id: string) => void }) {
  const { uid } = useSession();
  const { club, book, members, loading } = useClubLive(clubId, { windowDays: 1 });
  const { friends } = useFriends(uid, allClubIds);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (loading || !club || !book) return <Skeleton className="h-40 w-full" />;
  const isAdmin = members.find((m) => m.userId === uid)?.role === 'admin';
  const candidates = friends.filter((f) => !members.some((m) => m.userId === f.userId));

  return (
    <div>
      {allClubIds.length > 1 ? <BookPicker clubIds={allClubIds} active={clubId} onPick={onPick} /> : null}
      <h2 className="font-serif text-3xl">{book.title}</h2>
      <p className="mb-6 text-mute">Send this code or link to whoever should join.</p>
      <InviteShare code={club.inviteCode} bookTitle={book.title} />

      <section className="mt-10" aria-label="Members">
        <h3 className="font-serif text-2xl">Members</h3>
        <ul className="mt-2">
          {members.map((m) => (
            <li key={m.userId} className="hairline flex min-h-[3.25rem] items-center justify-between">
              <span>{m.userId === uid ? `${m.displayName} (you)` : m.displayName}</span>
              {m.role === 'admin' ? <span className="text-sm text-mute">Started this club</span> : null}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && candidates.length > 0 ? (
        <section className="mt-10">
          <h3 className="font-serif text-2xl">Already reading with you</h3>
          <p className="text-sm text-mute">They&apos;ll see an invitation on their home screen.</p>
          <ul className="mt-2">
            {candidates.map((f) => {
              const done = sent.includes(f.userId);
              return (
                <li key={f.userId} className="hairline flex min-h-[3.5rem] items-center justify-between">
                  <span>{f.displayName}</span>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={busy || done}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await inviteExistingFriends(club.inviteCode, [f.userId]);
                        setSent((s) => [...s, f.userId]);
                      } catch {
                        setError("Couldn't send the invitation. Check your connection and try again.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {done ? <><CheckIcon size={16} /> Invited</> : 'Invite'}
                  </button>
                </li>
              );
            })}
          </ul>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </section>
      ) : null}
    </div>
  );
}

function BookPicker({ clubIds, active, onPick }: { clubIds: string[]; active: string; onPick: (id: string) => void }) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Books">
      {clubIds.map((id) => (
        <PickerTab key={id} id={id} active={id === active} onPick={onPick} />
      ))}
    </div>
  );
}

function PickerTab({ id, active, onPick }: { id: string; active: boolean; onPick: (id: string) => void }) {
  const { book } = useClubLive(id, { windowDays: 1 });
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onPick(id)}
      className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${active ? 'border-ink bg-ink text-paper' : 'border-line text-mute'}`}
    >
      {book?.title ?? '…'}
    </button>
  );
}

function JoinWithCode() {
  const router = useRouter();
  const [code, setCode] = useState('');
  return (
    <form
      className="hairline mt-12 pt-8"
      onSubmit={(e) => {
        e.preventDefault();
        const c = normalizeInviteCode(code);
        if (c) router.push(`/join/${c}`);
      }}
    >
      <label htmlFor="code" className="font-serif text-2xl">Got a code?</label>
      <p className="mb-3 text-sm text-mute">Enter the one a friend sent you.</p>
      <div className="flex gap-3">
        <input id="code" className="field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="BKCLUB-7X92" autoCapitalize="characters" autoCorrect="off" />
        <button type="submit" className="btn-outline shrink-0" disabled={!code.trim()}>Join</button>
      </div>
    </form>
  );
}
