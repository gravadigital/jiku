import { signOut } from 'next-auth/react';

export function useLogout() {
  return () => signOut({ callbackUrl: '/login' });
}
