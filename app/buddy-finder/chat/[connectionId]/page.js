'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function LegacyChatRedirectPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (params.connectionId) {
      router.replace(`/messages/${params.connectionId}`);
    } else {
      router.replace('/messages');
    }
  }, [router, params]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );
}
