'use client';

import { useQuery } from '@tanstack/react-query';
import { getRequirementById } from '../services/requirementsApi';
import type { RequirementDetail } from '../types/requirement.types';

interface UseRequirementOptions {
  initialData?: RequirementDetail;
  enabled?: boolean;
}

export const useRequirement = (reqid: number, options: UseRequirementOptions = {}) => {
  return useQuery({
    queryFn: () => getRequirementById(reqid),
    queryKey: ['requirement', reqid],
    ...(options.initialData && { initialData: options.initialData }),
    ...(options.enabled !== undefined && { enabled: options.enabled }),
  });
};
