'use client';

import { useSession } from 'next-auth/react';

/** Ayuda de interfaz: la autoridad es jiku-docs (`permission_denied`). */
export const useCanRestrictDocs = (): boolean => {
  const { data: session } = useSession();
  return session?.user?.roles?.includes('admin') ?? false;
};
