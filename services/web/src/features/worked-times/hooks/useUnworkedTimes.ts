'use client';

import { useQuery } from '@tanstack/react-query';
import { getUnworkedTimes } from '../services/unworkedTimesApi';

export const useUnworkedTimes = (date: string, personId: number) => {
  return useQuery({
    enabled: !!date && !!personId,
    queryKey: ['unworked-times', date, personId],
    queryFn: () => getUnworkedTimes(date, personId),
  });
};
