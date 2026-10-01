'use client';

import { useEffect, useState } from 'react';

/** Calm, honest connectivity note. Appears only if we're offline or the live feed is stale for a moment. */
export function ConnectionBanner({ stale }: { stale: boolean }) {
  const [online, setOnline] = useState(true);
  const [showStale, setShowStale] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!stale) return setShowStale(false);
    const t = setTimeout(() => setShowStale(true), 2500);
    return () => clearTimeout(t);
  }, [stale]);

  if (online && !showStale) return null;
  return (
    <p role="status" className="mb-4 rounded-md bg-amber-soft px-4 py-2.5 text-sm text-amber">
      {online ? 'Connecting… What you see may be a moment behind.' : "You're offline. What you see may be out of date, and nothing is saved until you reconnect."}
    </p>
  );
}
