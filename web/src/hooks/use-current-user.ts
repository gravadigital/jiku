import { useSession } from 'next-auth/react';

export interface TCurrentUser {
  id: string;
  name: string;
}

export function useCurrentUser() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const { id, name } = session.user as { id: string; name: string; roles: string[] };
  return { id, name } as TCurrentUser;
}
