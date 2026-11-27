import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '@/lib/axios';
import { requirementsApi } from '../services/requirementsApi';
import { classifyRequirementError } from '../utils/classifyRequirementError';
import type { RequirementDetail } from '../types/requirement.types';

interface UseRequirementOptions {
  requirementId: number;
}

export function useRequirement({ requirementId }: UseRequirementOptions) {
  return useQuery<RequirementDetail>({
    queryKey: ['requirement', requirementId],
    queryFn: () => requirementsApi.getById(requirementId),
    enabled: !!requirementId && requirementId > 0,
    // REQ-020 DD-9: reintentar un 403/404 solo demora el aviso. Red y 5xx conservan un reintento
    // (`failureCount < 1` equivale al `retry: 1` global de queryClient).
    retry: (failureCount, error) =>
      classifyRequirementError(error as unknown as ApiError) === 'system' && failureCount < 1,
  });
}
