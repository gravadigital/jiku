'use client';

import { useSession } from 'next-auth/react';
import { useObjective } from './useObjective';

export function useCanEditObjective(objectiveId: number): boolean {
  const { data: session } = useSession();
  const { data: objective } = useObjective({ id: objectiveId });

  if (!session?.user || !objective) return false;

  const zitadelId = session.user.zitadelId;
  const isAdmin = session.user.roles?.includes('admin');
  const isCreator = objective.creator?.id === zitadelId;
  const isAssigned = objective.persons?.some((p) => p.userId === zitadelId);

  return Boolean(isAdmin || isCreator || isAssigned);
}
