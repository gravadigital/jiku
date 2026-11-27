'use client';

import { useQuery } from '@tanstack/react-query';
import { getClients } from '../services/clientsApi';

interface UseClientsOptions {
  enabled?: boolean;
}

export const useClients = (options: UseClientsOptions = {}) => {
  const { enabled = true } = options;

  return useQuery({
    enabled,
    queryFn: () => getClients(),
    queryKey: ['clients'],
  });
};
