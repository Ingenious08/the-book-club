'use client';

import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { useMemberships } from '@/hooks/useMemberships';
import { BookCompactCard } from '@/components/BookCompactCard';
import { PageTitle, Skeleton } from '@/components/ui';

export default function MyBooks() {
  const { uid } = useSession();
  const { memberships, loading } = useMemberships(uid);
  return (
    <div>
      <PageTitle>My books</PageTitle>
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : memberships.length === 0 ? (
        <p className="text-mute">Nothing on the reading list yet. Add a book and invite someone to read with you.</p>
      ) : (
        <ul>
          {memberships.map((m) => (
            <BookCompactCard key={m.clubId} clubId={m.clubId} />
          ))}
        </ul>
      )}
      <Link href="/books/new" className="btn-primary mt-8">+ Add Book</Link>
    </div>
  );
}
