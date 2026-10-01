'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useFriends, useMemberships } from '@/hooks/useMemberships';
import { createBookAndClub } from '@/firebase/actions';
import { ErrorNote, PageTitle } from '@/components/ui';

export default function NewBook() {
  const { uid, profile } = useSession();
  const router = useRouter();
  const { memberships } = useMemberships(uid);
  const { friends } = useFriends(uid, memberships.map((m) => m.clubId));
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('');
  const [cover, setCover] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = pages.trim() === '' ? null : Number(pages);
  const pagesValid = totalPages === null || (Number.isInteger(totalPages) && totalPages > 0 && totalPages <= 20000);
  const coverValid = cover.trim() === '' || /^https:\/\/\S+$/.test(cover.trim());
  const valid = title.trim().length > 0 && pagesValid && coverValid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !uid || !profile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { clubId } = await createBookAndClub({
        uid,
        displayName: profile.displayName,
        title,
        author,
        totalPages,
        coverImage: cover.trim() || null,
        timezone: profile.timezone,
        invitedUserIds: picked,
      });
      router.push(`/club/${clubId}`);
    } catch {
      setError("Couldn't add the book. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageTitle sub="Pick something you actually want to talk about.">Add a book</PageTitle>

      <div className="space-y-5">
        <div>
          <label htmlFor="t" className="mb-2 block font-medium">Title</label>
          <input id="t" className="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Atomic Habits" required />
        </div>
        <div>
          <label htmlFor="a" className="mb-2 block font-medium">Author</label>
          <input id="a" className="field" value={author} maxLength={120} onChange={(e) => setAuthor(e.target.value)} placeholder="James Clear" />
        </div>
        <div>
          <label htmlFor="p" className="mb-2 block font-medium">Total pages <span className="font-normal text-mute">(optional)</span></label>
          <input id="p" className="field" inputMode="numeric" value={pages} onChange={(e) => setPages(e.target.value.replace(/\D/g, ''))} placeholder="320" />
          {!pagesValid ? <ErrorNote>Use a whole number between 1 and 20,000.</ErrorNote> : null}
        </div>
        <div>
          <label htmlFor="c" className="mb-2 block font-medium">Cover image link <span className="font-normal text-mute">(optional)</span></label>
          <input id="c" className="field" type="url" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" />
          {!coverValid ? <ErrorNote>Use a link that starts with https://</ErrorNote> : null}
        </div>
      </div>

      <fieldset className="mt-10">
        <legend className="font-serif text-2xl">Who&apos;s reading this book?</legend>
        <p className="mt-1 text-sm text-mute">You&apos;re in. Choose people you already read with, or invite someone new next.</p>
        {friends.length === 0 ? (
          <p className="mt-4 text-mute">When you add a friend to any book, they&apos;ll show up here.</p>
        ) : (
          <ul className="mt-3">
            {friends.map((f) => {
              const on = picked.includes(f.userId);
              return (
                <li key={f.userId} className="hairline">
                  <label className="flex min-h-[3.5rem] cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[var(--leaf)]"
                      checked={on}
                      onChange={() => setPicked((p) => (on ? p.filter((x) => x !== f.userId) : [...p, f.userId]))}
                    />
                    <span>{f.displayName}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <button type="submit" className="btn-primary mt-8" disabled={!valid || busy}>
        {busy ? 'Adding…' : 'Add book'}
      </button>
    </form>
  );
}
