'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteObjective } from '../services/objectivesApi';

export const useDeleteObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteObjective(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
  });
};
