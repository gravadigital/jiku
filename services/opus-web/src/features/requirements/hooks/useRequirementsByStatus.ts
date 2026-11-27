import { useInfiniteQuery } from '@tanstack/react-query';
import { requirementsApi } from '../services/requirementsApi';
import type { Requirement } from '../types/requirement.types';

interface UseRequirementsByStatusOptions {
  projectId: number;
  status: string[];
  limit?: number;
}

const DEFAULT_LIMIT = 20;

export function useRequirementsByStatus({
  projectId,
  status,
  limit = DEFAULT_LIMIT,
}: UseRequirementsByStatusOptions) {
  return useInfiniteQuery<Requirement[]>({
    queryKey: ['requirements', projectId, 'byStatus', status],
    queryFn: ({ pageParam = 0 }) =>
      requirementsApi.getByStatus(projectId, {
        status,
        limit,
        skip: pageParam as number,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === limit) {
        return allPages.flat().length;
      }
      return undefined;
    },
    enabled: projectId > 0 && status.length > 0,
  });
}
