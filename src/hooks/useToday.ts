'use client';

import { useEffect, useState } from 'react';
import { dateIdInTz, secondsLeftToday } from '@/lib/dates';

/** The logical reading day for a timezone. Rolls over at midnight with no manual reset. */
export function useToday(tz: string) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 15000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, []);

  return { now, today: dateIdInTz(now, tz), secondsLeft: secondsLeftToday(now, tz) };
}
