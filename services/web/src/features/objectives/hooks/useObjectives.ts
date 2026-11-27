'use client';

import { useQuery } from '@tanstack/react-query';
import { getObjectives } from '../services/objectivesApi';
import type { ObjectiveFilters } from '../types/objective.types';

interface UseObjectivesOptions {
  filters?: ObjectiveFilters;
  enabled?: boolean;
}

export const useObjectives = (options: UseObjectivesOptions = {}) => {
  const { filters = {}, enabled = true } = options;

  return useQuery({
    enabled,
    queryFn: () => getObjectives(filters),
    queryKey: ['objectives', filters],
  });
};
