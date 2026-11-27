'use client';

import { useQuery } from '@tanstack/react-query';
import { getTagSuggestions } from '../services/requirementsApi';

export const useRequirementTagSuggestions = (projectId?: number | null) => {
  return useQuery({
    enabled: !!projectId,
    queryFn: () => getTagSuggestions(projectId!),
    queryKey: ['requirements-tags', projectId],
  });
};
