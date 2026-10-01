import type { ReactNode } from 'react';
import { CheckIcon, RingIcon } from './ui';

export interface Page {
  userId: string;
  name: string;
  isMe: boolean;
  page: number | null;
  ready: boolean;
}

/**
 * Today as an open book: each reader gets a page, with a gutter between.
 * When everyone is ready the gutter closes and turns green.
 */
export function Spread({
  pages,
  totalPages,
  allReady,
  celebrate = false,
  editor,
}: {
  pages: Page[];
  totalPages: number | null;
  allReady: boolean;
  /** True only when readiness flipped live on this screen, never on first load. */
  celebrate?: boolean;
  /** Replaces my numeral with an input while I'm entering/changing my page. */
  editor?: ReactNode;
}) {
  const cols = pages.length === 1 ? 1 : 2;
  return (
    <div className={`spread ${allReady && celebrate ? 'settle' : ''}`} data-cols={cols} data-ready={allReady}>
      <ul className={`grid ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {pages.map((p) => (
          <li key={p.userId} className="px-3 pb-6 pt-7 text-center sm:px-6">
            <p className="truncate text-[0.95rem] text-mute">{p.isMe ? 'You' : p.name}</p>
            <div className="mt-3 flex min-h-[3.4rem] items-end justify-center">
              {p.isMe && editor ? (
                <div className="w-full px-2 sm:px-6">{editor}</div>
              ) : (
                <span className={`numeral ${p.page ? '' : 'text-line'}`}>{p.page ?? '–'}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-mute">{totalPages && p.page ? `of ${totalPages}` : 'page'}</p>
            <p className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${p.ready ? 'text-leaf' : 'text-mute'}`}>
              {p.ready ? <CheckIcon size={16} /> : <RingIcon size={16} />}
              {p.ready ? 'Open for discussion' : p.isMe ? 'Your turn' : 'Still reading'}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
