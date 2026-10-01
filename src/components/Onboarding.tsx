'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { createBookAndClub, createProfile } from '@/firebase/actions';
import { DEFAULT_TIMEZONE, safeTimezone } from '@/lib/dates';
import { ErrorNote } from './ui';

function deviceTimezone(): string {
  try {
    return safeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

type Phase = 'ask' | 'saving' | 'welcome';

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { uid } = useSession();
  const pathname = usePathname();
  const comingFromInvite = pathname.startsWith('/join/');
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<Phase>('ask');
  const [error, setError] = useState<string | null>(null);
  const [addedBook, setAddedBook] = useState<{ title: string; author: string } | null>(null);
  const [step, setStep] = useState(0);
  const [welcomedAs, setWelcomedAs] = useState('');

  const defaultTitle = process.env.NEXT_PUBLIC_DEFAULT_BOOK_TITLE?.trim();
  const defaultAuthor = process.env.NEXT_PUBLIC_DEFAULT_BOOK_AUTHOR?.trim() ?? '';
  const defaultPages = Number(process.env.NEXT_PUBLIC_DEFAULT_BOOK_TOTAL_PAGES);

  // Sequence the welcome only AFTER Firebase has confirmed the writes (phase === 'welcome').
  useEffect(() => {
    if (phase !== 'welcome') return;
    const t1 = setTimeout(() => setStep(1), 1300);
    const t2 = setTimeout(() => setStep(2), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || !uid) return;
    setPhase('saving');
    setError(null);
    try {
      const tz = deviceTimezone();
      await createProfile(uid, clean, tz);
      let added: { title: string; author: string } | null = null;
      if (!comingFromInvite && defaultTitle) {
        await createBookAndClub({
          uid,
          displayName: clean,
          title: defaultTitle,
          author: defaultAuthor,
          totalPages: Number.isInteger(defaultPages) && defaultPages > 0 ? defaultPages : null,
          coverImage: null,
          timezone: tz,
          invitedUserIds: [],
        });
        added = { title: defaultTitle, author: defaultAuthor };
      }
      setWelcomedAs(clean);
      setAddedBook(added);
      setPhase('welcome');
    } catch {
      setPhase('ask');
      setError("Couldn't save your name. Check your connection and try again.");
    }
  }

  if (phase === 'welcome') {
    const last = addedBook ? 2 : 1;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-6 py-16" aria-live="polite">
        <h1 className="fade-in font-serif text-5xl leading-tight">Welcome, {welcomedAs}.</h1>
        {step >= 1 ? <p className="fade-in mt-5 text-xl text-mute">You&apos;ve joined The Book Club.</p> : null}
        {step >= 2 && addedBook ? (
          <div className="fade-in mt-8">
            <p className="text-mute">Added to</p>
            <p className="font-serif text-3xl">{addedBook.title}</p>
            {addedBook.author ? <p className="text-mute">by {addedBook.author}</p> : null}
          </div>
        ) : null}
        {step >= last ? (
          <button type="button" onClick={onFinish} className="btn-primary fade-in mt-12">
            Let&apos;s read
          </button>
        ) : null}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-6xl leading-[0.98] tracking-tight">The Book Club</h1>
      <p className="mt-6 font-serif text-3xl leading-snug text-mute">
        Read something.
        <br />
        Think about it.
        <br />
        Talk about it.
      </p>

      <form onSubmit={submit} className="mt-14">
        <label htmlFor="name" className="block text-lg font-medium">
          What&apos;s your name?
        </label>
        <input
          id="name"
          className="field mt-3"
          placeholder="Aagam"
          autoComplete="given-name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={phase === 'saving'}
          autoFocus
        />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <button type="submit" className="btn-primary mt-4" disabled={!name.trim() || phase === 'saving' || !uid}>
          {phase === 'saving' ? 'Joining…' : 'Continue'}
        </button>
        {!comingFromInvite ? (
          <p className="mt-5 text-sm text-mute">Got an invite from a friend? Open their link, and you&apos;ll land in their club.</p>
        ) : null}
      </form>
    </main>
  );
}
