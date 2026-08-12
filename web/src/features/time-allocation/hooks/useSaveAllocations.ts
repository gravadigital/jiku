'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveWeekAllocations } from '../services/timeAllocationApi';
import type {
  WeekAllocationResponse,
  WeekAllocationSaveItem,
} from '../types/time-allocation.types';

export const useSaveAllocations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      weekStart,
      allocations,
    }: {
      weekStart: string;
      allocations: WeekAllocationSaveItem[];
    }) => saveWeekAllocations(weekStart, allocations),
    onSuccess: (data) => {
      // Get existing data to preserve persons and projects arrays
      const existingData = queryClient.getQueryData<WeekAllocationResponse>([
        'week-allocations',
        data.weekStart,
      ]);

      if (existingData) {
        // Merge save response with existing data
        queryClient.setQueryData(['week-allocations', data.weekStart], {
          ...existingData,
          allocations: data.allocations,
          weekStart: data.weekStart,
          weekEnd: data.weekEnd,
        });
      } else {
        // If no existing data, invalidate to fetch fresh data
        queryClient.invalidateQueries({
          queryKey: ['week-allocations', data.weekStart],
        });
      }
    },
  });
};
