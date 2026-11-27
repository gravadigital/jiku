import { useSession } from 'next-auth/react';

export interface TCurrentUser {
  id: string;
  name: string;
  /**
   * `sub` de Zitadel: lo que jiku-docs guarda como autor, `updatedBy` y `holder` de la reserva.
   * No confundir con `id` (uuid de Jiku). `null` si la sesión no lo trae.
   */
  zitadelId: string | null;
}

export function useCurrentUser() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const { id, name, zitadelId } = session.user;
  return { id, name, zitadelId: zitadelId || null } as TCurrentUser;
}
