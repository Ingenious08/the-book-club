'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isFirebaseConfigured } from '@/firebase/client';
import { SessionProvider, useSession } from '@/hooks/useSession';
import { CloseIcon, MenuIcon, Skeleton } from './ui';
import { Onboarding } from './Onboarding';

export function AppShell({ children }: { children: ReactNode }) {
  if (!isFirebaseConfigured) return <SetupNeeded />;
  return (
    <SessionProvider>
      <Gate>{children}</Gate>
    </SessionProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { status, profile, error } = useSession();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Latch: once we see "no profile", keep onboarding on screen until it finishes its welcome sequence.
  useEffect(() => {
    if (profile === null) setNeedsOnboarding(true);
  }, [profile]);

  if (status === 'error') {
    return (
      <Centered>
        <h1 className="font-serif text-3xl">We couldn&apos;t connect.</h1>
        <p className="mt-3 text-mute">
          Check your connection and reload. If this keeps happening, make sure Anonymous sign-in is enabled in your Firebase project.
        </p>
        {error ? <p className="mt-4 text-xs text-mute break-words">{error}</p> : null}
      </Centered>
    );
  }
  if (status === 'loading' || profile === undefined) return <Splash />;
  if (profile === null || needsOnboarding) return <Onboarding onFinish={() => setNeedsOnboarding(false)} />;
  return <Shell>{children}</Shell>;
}

function Splash() {
  return (
    <Centered>
      <p className="font-serif text-4xl">The Book Club</p>
      <p className="mt-3 text-mute" role="status">Loading…</p>
      <div className="mt-8 space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-6 py-16">{children}</main>;
}

function SetupNeeded() {
  return (
    <Centered>
      <h1 className="font-serif text-4xl">Connect Firebase to begin.</h1>
      <p className="mt-4 text-mute leading-relaxed">
        The Book Club keeps everything in Firebase so both of you see the same thing, live. Copy <code>.env.example</code> to{' '}
        <code>.env.local</code>, fill in your Firebase web app values, then restart the dev server. Full steps are in the README.
      </p>
    </Centered>
  );
}

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/books', label: 'My Books' },
  { href: '/logs', label: 'Logs' },
  { href: '/books/new', label: 'Add Book' },
  { href: '/friends', label: 'Add Friend' },
  { href: '/settings', label: 'Settings' },
];

function Shell({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);

  // Close the menu on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // Sync the theme: Firestore is the source of truth; localStorage only prevents a flash.
  useEffect(() => {
    const t = profile?.theme ?? 'system';
    const root = document.documentElement;
    if (t === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
    try {
      localStorage.setItem('bc-theme', t);
    } catch {}
  }, [profile?.theme]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuBtn.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[560px] px-5 pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex h-16 items-center justify-between">
        <Link href="/" className="font-serif text-[1.45rem] tracking-tight" aria-label="The Book Club, home">
          The Book Club
        </Link>
        <button
          ref={menuBtn}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="main-menu"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full"
        >
          <MenuIcon />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <nav
            id="main-menu"
            className="sheet-in absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col bg-paper px-6 pb-8"
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
          >
            <div className="flex h-12 items-center justify-between">
              <span className="text-mute">{profile?.displayName}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="-mr-2 flex h-11 w-11 items-center justify-center">
                <CloseIcon />
              </button>
            </div>
            <ul className="mt-4">
              {NAV.map((n) => {
                const active = n.href === '/' ? pathname === '/' : pathname === n.href;
                return (
                  <li key={n.href} className="hairline">
                    <Link
                      href={n.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-[3.5rem] items-center font-serif text-[1.75rem] ${active ? 'text-ink' : 'text-mute'}`}
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}

      <main id="content">{children}</main>
    </div>
  );
}
