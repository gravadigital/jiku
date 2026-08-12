'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../services/clientsApi';
import type { CreateClientPayload } from '../types/client.types';

export const useCreateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateClientPayload) => createClient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
};
