'use client';

import { useQuery } from '@tanstack/react-query';
import { getWorkedTimesMultipleDates } from '../services/workedTimesApi';

export const useWorkedTimesRange = (dates: string[], personId: number) => {
  return useQuery({
    queryKey: ['worked-times', 'range', dates, personId],
    queryFn: () => getWorkedTimesMultipleDates(dates, personId),
    enabled: dates.length > 0 && !!personId,
  });
};
