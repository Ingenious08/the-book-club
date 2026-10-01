'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getFirebase } from '@/firebase/client';
import type { Invite, Membership } from '@/types';
import { fetchMembers } from '@/firebase/actions';

/** My clubs: one cheap listener on users/{uid}/memberships. */
export function useMemberships(uid: string | null) {
  const [memberships, setMemberships] = useState<Membership[] | undefined>(undefined);

  useEffect(() => {
    if (!uid) return;
    const { db } = getFirebase();
    return onSnapshot(
      collection(db, 'users', uid, 'memberships'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Membership);
        list.sort((a, b) => (a.joinedAt?.toMillis() ?? Date.now()) - (b.joinedAt?.toMillis() ?? Date.now()));
        setMemberships(list);
      },
      () => setMemberships([]),
    );
  }, [uid]);

  return { memberships: memberships ?? [], loading: memberships === undefined };
}

/** Invitations addressed to me (created when someone picks me while adding a book). */
export function useInvitations(uid: string | null, joinedClubIds: string[]) {
  const [invites, setInvites] = useState<Invite[]>([]);

  useEffect(() => {
    if (!uid) return;
    const { db } = getFirebase();
    return onSnapshot(
      query(collection(db, 'invites'), where('invitedUserIds', 'array-contains', uid)),
      (snap) => setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invite)),
      () => setInvites([]),
    );
  }, [uid]);

  return invites.filter((i) => i.active && !joinedClubIds.includes(i.clubId));
}

export interface Friend {
  userId: string;
  displayName: string;
}

/** People I already read with, derived from the members of my clubs (no separate social graph). */
export function useFriends(uid: string | null, clubIds: string[]) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const key = clubIds.join(',');

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await Promise.all(clubIds.map((id) => fetchMembers(id)));
        const map = new Map<string, Friend>();
        for (const list of all) for (const m of list) if (m.userId !== uid) map.set(m.userId, { userId: m.userId, displayName: m.displayName });
        if (!cancelled) setFriends(Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key]);

  return { friends, loading };
}
