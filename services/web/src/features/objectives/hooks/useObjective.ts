'use client';

import { useQuery } from '@tanstack/react-query';
import { getObjectiveById } from '../services/objectivesApi';

interface UseObjectiveOptions {
  id: number;
  enabled?: boolean;
}

export const useObjective = ({ id, enabled = true }: UseObjectiveOptions) => {
  return useQuery({
    enabled: enabled && Boolean(id),
    queryFn: () => getObjectiveById(id),
    queryKey: ['objective', id],
  });
};
