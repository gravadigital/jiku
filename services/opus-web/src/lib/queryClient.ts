import { QueryClient } from '@tanstack/react-query';

export const defaultQueryClientOptions = {
  queries: {
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos (antes cacheTime)
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: 0,
  },
};

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: defaultQueryClientOptions,
  });
}
