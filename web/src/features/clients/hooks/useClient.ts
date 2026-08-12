'use client';

import { useQuery } from '@tanstack/react-query';
import { getClientById } from '../services/clientsApi';

interface UseClientOptions {
  id: number;
  enabled?: boolean;
}

export const useClient = ({ id, enabled = true }: UseClientOptions) => {
  return useQuery({
    enabled: enabled && Boolean(id),
    queryFn: () => getClientById(id),
    queryKey: ['client', id],
  });
};
