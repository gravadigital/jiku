'use client';

import { useQuery } from '@tanstack/react-query';
import { getPersonRequirements } from '../services/workedTimesApi';

export const usePersonRequirements = (personId: number) => {
  return useQuery({
    queryKey: ['person-requirements', personId],
    queryFn: () => getPersonRequirements(personId),
    enabled: !!personId,
  });
};
