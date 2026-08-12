'use client';

import { useQuery } from '@tanstack/react-query';
import { getPersonObjectives } from '../services/workedTimesApi';

export const usePersonObjectives = (personId: number) => {
  return useQuery({
    queryKey: ['person-objectives', personId],
    queryFn: () => getPersonObjectives(personId),
    enabled: !!personId,
  });
};
