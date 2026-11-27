'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateObjective, updateObjectiveState } from '../services/objectivesApi';
import type { UpdateObjectivePayload } from '../types/objective.types';

interface UpdateObjectiveParams {
  id: number;
  payload: UpdateObjectivePayload;
}

export const useUpdateObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: UpdateObjectiveParams) => updateObjective(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objective', id] });
    },
  });
};

interface UpdateObjectiveStateParams {
  id: number;
  state: string;
}

export const useUpdateObjectiveState = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, state }: UpdateObjectiveStateParams) => updateObjectiveState(id, state),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objective', id] });
    },
  });
};
