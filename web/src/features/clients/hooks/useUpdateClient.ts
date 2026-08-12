'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateClient } from '../services/clientsApi';
import type { UpdateClientPayload } from '../types/client.types';

export const useUpdateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateClientPayload }) =>
      updateClient(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.id] });
    },
  });
};
