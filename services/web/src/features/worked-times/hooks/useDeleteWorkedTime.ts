'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteWorkedTime } from '../services/workedTimesApi';

export const useDeleteWorkedTime = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteWorkedTime(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worked-times'] });
    },
  });
};
