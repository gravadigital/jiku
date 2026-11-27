import { signOut } from 'next-auth/react';

export function useLogout() {
  const logout = () => {
    signOut({ callbackUrl: '/login' });
  };

  return {
    logout,
  };
}
