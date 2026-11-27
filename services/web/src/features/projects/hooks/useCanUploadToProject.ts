'use client';

import { useSession } from 'next-auth/react';

export function useCanUploadToProject(): boolean {
  const { data: session } = useSession();

  if (!session?.user) return false;

  const roles: string[] = session.user.roles ?? [];
  return roles.includes('admin') || roles.includes('user');
}
