'use client';

import { useQuery } from '@tanstack/react-query';
import { getHoursPerDay } from '../services/timeAllocationApi';

export const useHoursPerDay = () => {
  return useQuery({
    queryFn: () => getHoursPerDay(),
    queryKey: ['settings', 'hours-per-day'],
  });
};
