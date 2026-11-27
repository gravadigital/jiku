'use client';

import { useQuery } from '@tanstack/react-query';
import { getWorkedTimes } from '../services/workedTimesApi';

export const useWorkedTimes = (date: string, personId: number) => {
  return useQuery({
    queryKey: ['worked-times', date, personId],
    queryFn: () => getWorkedTimes(date, personId),
    enabled: !!date && !!personId,
  });
};
