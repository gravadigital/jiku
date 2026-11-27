'use client';

import { useQuery } from '@tanstack/react-query';
import { getWeekAllocations } from '../services/timeAllocationApi';

interface UseWeekAllocationsOptions {
  enabled?: boolean;
}

export const useWeekAllocations = (weekStart: string, options: UseWeekAllocationsOptions = {}) => {
  const { enabled = true } = options;

  return useQuery({
    enabled: enabled && Boolean(weekStart),
    queryFn: () => getWeekAllocations(weekStart),
    queryKey: ['week-allocations', weekStart],
  });
};
