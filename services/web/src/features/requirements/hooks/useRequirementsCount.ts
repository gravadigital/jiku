'use client';

import { useQuery } from '@tanstack/react-query';
import { getRequirementsCount } from '../services/requirementsApi';
import type { RequirementFilters } from '../types/requirement.types';

export const useRequirementsCount = (filters: RequirementFilters = {}) => {
  return useQuery({
    queryFn: () => getRequirementsCount(filters),
    queryKey: ['requirements-count', filters],
  });
};
