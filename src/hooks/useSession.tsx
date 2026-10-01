'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/firebase/client';
import type { AppUser } from '@/types';

interface Session {
  status: 'loading' | 'ready' | 'error';
  uid: string | null;
  /** undefined = still loading, null = signed in but no profile yet (first run) */
  profile: AppUser | null | undefined;
  error: string | null;
}

const SessionContext = createContext<Session>({ status: 'loading', uid: null, profile: undefined, error: null });

/**
 * Anonymous Firebase Auth. The UID persists in the browser's IndexedDB, so the same
 * device keeps the same identity across refreshes and restarts.
 * Upgrade path: link a Google/email credential to this same user with linkWithPopup /
 * linkWithCredential; the UID, and therefore all data, stays the same.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { auth } = getFirebase();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        setAuthReady(true);
      } else {
        signInAnonymously(auth).catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Sign-in failed');
        });
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const { db } = getFirebase();
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as AppUser) : null),
      (e) => setError(e.message),
    );
    return unsub;
  }, [uid]);

  const value = useMemo<Session>(
    () => ({ status: error ? 'error' : authReady ? 'ready' : 'loading', uid, profile, error }),
    [error, authReady, uid, profile],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
