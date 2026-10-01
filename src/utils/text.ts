export function listNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

export function randomInviteCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `BKCLUB-${body}`;
}

export function normalizeInviteCode(raw: string): string {
  const c = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return '';
  return c.startsWith('BKCLUB-') ? c : `BKCLUB-${c}`;
}

export function parsePage(raw: string): number | null {
  if (!/^\d{1,5}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}
