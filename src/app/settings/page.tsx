'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useMemberships } from '@/hooks/useMemberships';
import { useClubLive } from '@/hooks/useClubLive';
import { leaveClub, renameUser, setClubTimezone, updateProfile } from '@/firebase/actions';
import { commonTimezones, safeTimezone } from '@/lib/dates';
import { ErrorNote, PageTitle } from '@/components/ui';
import type { NotificationPrefs, ThemePref } from '@/types';

const THEMES: Array<{ id: ThemePref; label: string }> = [
  { id: 'system', label: 'Match device' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

function tzOptions(current: string) {
  const list = commonTimezones();
  return list.includes(current) ? list : [current, ...list];
}

export default function Settings() {
  const { uid, profile } = useSession();
  const { memberships } = useMemberships(uid);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setName(profile.displayName);
  }, [profile]);

  if (!profile || !uid) return null;

  async function run(fn: () => Promise<void>, ok: string) {
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    }
  }

  const notif: NotificationPrefs = profile.notifications ?? { reminders: false, partnerReady: false };

  return (
    <div>
      <PageTitle>Settings</PageTitle>
      <div role="status" className="min-h-5 text-sm text-leaf">{msg}</div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <section className="mb-10">
        <label htmlFor="name" className="mb-2 block font-medium">Name</label>
        <div className="flex gap-3">
          <input id="name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <button
            type="button"
            className="btn-outline shrink-0"
            disabled={!name.trim() || name.trim() === profile.displayName}
            onClick={() => run(() => renameUser(uid, name, memberships.map((m) => m.clubId)), 'Name updated.')}
          >
            Save
          </button>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 font-medium">Theme</h2>
        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={profile.theme === t.id}
              onClick={() => run(() => updateProfile(uid, { theme: t.id }), 'Theme updated.')}
              className={`min-h-11 rounded-full border px-4 text-sm ${profile.theme === t.id ? 'border-ink bg-ink text-paper' : 'border-line text-mute'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <label htmlFor="tz" className="mb-2 block font-medium">Timezone</label>
        <select
          id="tz"
          className="field"
          value={safeTimezone(profile.timezone)}
          onChange={(e) => run(() => updateProfile(uid, { timezone: e.target.value }), 'Timezone updated for new books.')}
        >
          {tzOptions(safeTimezone(profile.timezone)).map((z) => (
            <option key={z} value={z}>{z.replace('_', ' ')}</option>
          ))}
        </select>
        <p className="mt-2 text-sm text-mute">Each book keeps the timezone it was created with, so everyone in a club shares the same day.</p>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 font-medium">Notifications</h2>
        <p className="mb-2 text-sm text-mute">Saved now, switched on in a future update.</p>
        {(
          [
            ['reminders', 'Remind me before today closes'],
            ['partnerReady', 'Tell me when a friend is ready'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="hairline flex min-h-[3.5rem] cursor-pointer items-center justify-between gap-4">
            <span>{label}</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--leaf)]"
              checked={notif[key]}
              onChange={(e) => run(() => updateProfile(uid, { notifications: { ...notif, [key]: e.target.checked } }), 'Saved.')}
            />
          </label>
        ))}
      </section>

      {memberships.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-2 font-medium">Your clubs</h2>
          <ul>
            {memberships.map((m) => (
              <ClubRow key={m.clubId} clubId={m.clubId} uid={uid} run={run} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-mute">
        You&apos;re signed in on this device. Sign-in with Google or email can be added later without losing anything.
      </p>
    </div>
  );
}

function ClubRow({ clubId, uid, run }: { clubId: string; uid: string; run: (fn: () => Promise<void>, ok: string) => Promise<void> }) {
  const { club, book, members, tz, loading } = useClubLive(clubId, { windowDays: 1 });
  const [confirm, setConfirm] = useState(false);
  if (loading || !club || !book) return null;
  const me = members.find((m) => m.userId === uid);
  const isAdmin = me?.role === 'admin';
  const adminBlocked = isAdmin && members.length > 1;

  return (
    <li className="hairline py-4">
      <p className="font-serif text-2xl">{book.title}</p>
      <p className="text-sm text-mute">{members.length} {members.length === 1 ? 'reader' : 'readers'}</p>

      {isAdmin ? (
        <div className="mt-3">
          <label htmlFor={`tz-${clubId}`} className="mb-1 block text-sm text-mute">Club timezone</label>
          <select
            id={`tz-${clubId}`}
            className="field"
            value={tz}
            onChange={(e) => run(() => setClubTimezone(clubId, e.target.value), 'Club timezone updated.')}
          >
            {tzOptions(tz).map((z) => (
              <option key={z} value={z}>{z.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-3">
        {adminBlocked ? (
          <p className="text-sm text-mute">You started this club, so it stays until the others have left.</p>
        ) : confirm ? (
          <div className="flex items-center gap-3">
            <button type="button" className="btn-outline" onClick={() => run(() => leaveClub(uid, clubId), 'You left the club.')}>Yes, leave</button>
            <button type="button" className="btn-quiet" onClick={() => setConfirm(false)}>Stay</button>
          </div>
        ) : (
          <button type="button" className="btn-quiet px-0" onClick={() => setConfirm(true)}>Leave club</button>
        )}
      </div>
    </li>
  );
}
