'use client';

import { useState } from 'react';
import { saveDiscussionNote } from '@/firebase/actions';
import type { ReadingEntry } from '@/types';
import { ErrorNote } from './ui';

const PROMPTS = [
  'What did you learn?',
  'What surprised you?',
  'What made you think?',
  'What will you actually apply?',
  'What question are you carrying forward?',
];

export function DiscussionCard({
  clubId,
  uid,
  date,
  myNote,
  others,
}: {
  clubId: string;
  uid: string;
  date: string;
  myNote: string;
  others: Array<{ name: string; entry?: ReadingEntry }>;
}) {
  const [note, setNote] = useState(myNote);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = note.trim() !== myNote.trim();

  async function save() {
    setState('saving');
    try {
      await saveDiscussionNote(clubId, uid, date, note);
      setState('saved');
    } catch {
      setState('error');
    }
  }

  const sharedNotes = others.filter((o) => o.entry?.discussionNote);

  return (
    <section className="fade-in mt-6 rounded-md border border-line bg-surface px-5 py-6" aria-labelledby="discuss-h">
      <h2 id="discuss-h" className="font-serif text-3xl">Today&apos;s discussion</h2>
      <p className="mt-1 text-sm text-mute">Hop on a call or a voice note, and talk it through.</p>
      <ul className="mt-5 space-y-3 font-serif text-[1.35rem] leading-snug">
        {PROMPTS.map((p) => (
          <li key={p} className="hairline pt-3 first:border-t-0 first:pt-0">
            {p}
          </li>
        ))}
      </ul>

      <div className="hairline mt-6 pt-5">
        <label htmlFor="note" className="font-medium">What stayed with you?</label>
        <p className="text-sm text-mute">Optional. A line is plenty.</p>
        <textarea
          id="note"
          className="field mt-3"
          maxLength={1000}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setState('idle');
          }}
          placeholder="One idea worth keeping…"
        />
        <div className="mt-3 flex items-center gap-4">
          <button type="button" className="btn-outline" onClick={save} disabled={!dirty || state === 'saving'}>
            {state === 'saving' ? 'Saving…' : 'Save note'}
          </button>
          <span role="status" className="text-sm text-leaf">{state === 'saved' && !dirty ? 'Saved.' : ''}</span>
        </div>
        {state === 'error' ? <ErrorNote>Couldn&apos;t save your note. Check your connection and try again.</ErrorNote> : null}
      </div>

      {sharedNotes.length > 0 ? (
        <div className="hairline mt-6 space-y-4 pt-5">
          {sharedNotes.map((o) => (
            <figure key={o.name}>
              <blockquote className="font-serif text-xl leading-snug">{o.entry?.discussionNote}</blockquote>
              <figcaption className="mt-1 text-sm text-mute">{o.name}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
