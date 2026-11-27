'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWorkedTime } from '../services/workedTimesApi';
import type { CreateWorkedTimePayload } from '../types/worked-time.types';

export const useCreateWorkedTime = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkedTimePayload) => createWorkedTime(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worked-times'] });
    },
  });
};
