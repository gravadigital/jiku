import { useQuery } from '@tanstack/react-query';
import { requirementsApi } from '../services/requirementsApi';
import type { RequirementDetail } from '../types/requirement.types';

interface UseRequirementOptions {
  requirementId: number;
}

export function useRequirement({ requirementId }: UseRequirementOptions) {
  return useQuery<RequirementDetail>({
    queryKey: ['requirement', requirementId],
    queryFn: () => requirementsApi.getById(requirementId),
    enabled: !!requirementId && requirementId > 0,
  });
}
