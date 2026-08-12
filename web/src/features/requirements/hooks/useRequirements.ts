'use client';

import { useQuery } from '@tanstack/react-query';
import { getRequirements } from '../services/requirementsApi';
import type { RequirementFilters } from '../types/requirement.types';

interface UseRequirementsOptions {
  filters?: RequirementFilters;
  enabled?: boolean;
}

export const useRequirements = (options: UseRequirementsOptions = {}) => {
  const { filters = {}, enabled = true } = options;

  return useQuery({
    enabled,
    queryFn: () => getRequirements(filters),
    queryKey: ['requirements', filters],
  });
};
