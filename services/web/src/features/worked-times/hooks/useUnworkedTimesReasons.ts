'use client';

import { useQuery } from '@tanstack/react-query';
import { getUnworkedTimesReasons } from '../services/unworkedTimesApi';

export const useUnworkedTimesReasons = () => {
  return useQuery({
    queryKey: ['unworked-times-reasons'],
    queryFn: getUnworkedTimesReasons,
    staleTime: 10 * 60 * 1000,
  });
};
