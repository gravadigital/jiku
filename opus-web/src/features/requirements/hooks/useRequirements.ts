import { useQuery } from '@tanstack/react-query';
import { requirementsApi } from '../services/requirementsApi';
import type { Requirement } from '../types/requirement.types';

interface UseRequirementsOptions {
  projectId: number;
}

export function useRequirements({ projectId }: UseRequirementsOptions) {
  return useQuery<Requirement[]>({
    queryKey: ['requirements', projectId],
    queryFn: () => requirementsApi.getByProject(projectId),
    enabled: projectId > 0,
  });
}
