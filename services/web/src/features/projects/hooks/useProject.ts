'use client';

import { useQuery } from '@tanstack/react-query';
import { getProjectById } from '../services/projectsApi';

interface UseProjectOptions {
  id: number;
  enabled?: boolean;
}

export const useProject = ({ id, enabled = true }: UseProjectOptions) => {
  return useQuery({
    enabled: enabled && Boolean(id),
    queryFn: () => getProjectById(id),
    queryKey: ['project', id],
  });
};
