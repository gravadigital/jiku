'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createObjective } from '../services/objectivesApi';
import type { CreateObjectivePayload } from '../types/objective.types';

export const useCreateObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateObjectivePayload) => createObjective(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
  });
};
