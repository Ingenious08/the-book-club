'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useMemberships } from '@/hooks/useMemberships';
import { getInvite, joinClubByCode } from '@/firebase/actions';
import { normalizeInviteCode } from '@/utils/text';
import { ErrorNote, Skeleton } from '@/components/ui';
import type { Invite } from '@/types';

export default function JoinPage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = normalizeInviteCode(decodeURIComponent(raw));
  const { uid, profile } = useSession();
  const { memberships, loading } = useMemberships(uid);
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInvite(code)
      .then((i) => !cancelled && setInvite(i))
      .catch(() => !cancelled && setInvite(null));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const alreadyIn = invite && memberships.some((m) => m.clubId === invite.clubId);
  useEffect(() => {
    if (alreadyIn && invite) router.replace(`/club/${invite.clubId}`);
  }, [alreadyIn, invite, router]);

  if (invite === undefined || loading) return <Skeleton className="h-40 w-full" />;
  if (!invite || !invite.active) {
    return (
      <div className="py-10">
        <h1 className="font-serif text-4xl">That code doesn&apos;t work.</h1>
        <p className="mt-3 text-mute">Check it with your friend. It looks like BKCLUB-7X92.</p>
      </div>
    );
  }

  async function join() {
    if (!uid || !profile || !invite) return;
    setBusy(true);
    setError(null);
    try {
      const clubId = await joinClubByCode(uid, profile.displayName, code);
      router.replace(`/club/${clubId}`);
    } catch {
      setError("Couldn't join. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="py-8">
      <p className="text-mute">{invite.createdByName} invited you to read</p>
      <h1 className="mt-2 font-serif text-5xl leading-[1.02] tracking-tight">{invite.bookTitle}</h1>
      {invite.bookAuthor ? <p className="mt-2 text-lg text-mute">by {invite.bookAuthor}</p> : null}
      <p className="mt-6 text-mute">Read a little every day, tell each other how far you got, and talk once you&apos;re both done.</p>
      <button type="button" className="btn-primary mt-10" onClick={join} disabled={busy || !!alreadyIn}>
        {busy ? 'Joining…' : 'Join the club'}
      </button>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}
