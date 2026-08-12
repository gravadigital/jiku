'use client';

// NOTE: Local development — auth bypassed.
// The API bypasses auth when IDENTITY_URL is empty,
// so the web client does not need a valid session.
// Remove this comment and restore the redirect when deploying.

export function useSessionMonitor() {
  // No-op for local development
}

/*
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {useSession} from 'next-auth/react';

export function useSessionMonitor() {
  const {data: session, status} = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/login');
    }
  }, [session, status, router]);
}

*/
