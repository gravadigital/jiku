'use client';

import { useQuery } from '@tanstack/react-query';
import { getClients } from '../services/clientsApi';
import type { ClientFilters } from '../types/client.types';

interface UseClientsOptions {
  filters?: ClientFilters;
  enabled?: boolean;
}

export const useClients = (options: UseClientsOptions = {}) => {
  const { filters = {}, enabled = true } = options;

  return useQuery({
    enabled,
    queryFn: () => getClients(filters),
    queryKey: ['clients', filters],
  });
};
