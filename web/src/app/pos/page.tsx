'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PosRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div
      style={{
        padding: '32px',
        textAlign: 'center',
        fontSize: '14px',
        color: 'var(--muted)',
        fontFamily: 'sans-serif',
      }}
    >
      Redirecting to POS Terminal...
    </div>
  );
}
