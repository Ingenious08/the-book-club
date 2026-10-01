'use client';

import { useParams } from 'next/navigation';
import { ClubScreen } from '@/components/ClubScreen';

export default function ClubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  return <ClubScreen key={clubId} clubId={clubId} showGreeting={false} />;
}
