'use client';

import { useState } from 'react';

export function InviteShare({ code, bookTitle }: { code: string; bookTitle: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/join/${code}`;

  async function share() {
    const text = `Read ${bookTitle} with me on The Book Club.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'The Book Club', text, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <div>
      <p className="font-serif text-4xl tracking-wide" aria-label={`Invite code ${code.split('').join(' ')}`}>{code}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={share} className="btn-outline">Share invite link</button>
        <button
          type="button"
          className="btn-quiet"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
        >
          Copy link
        </button>
        <span role="status" className="text-sm text-leaf">{copied ? 'Copied.' : ''}</span>
      </div>
    </div>
  );
}
