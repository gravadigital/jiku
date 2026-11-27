import { QueryClient } from '@tanstack/react-query';

// 30 segundos
const STALE_TIME = 30 * 1000;
// 5 minutos
const GC_TIME = 5 * 60 * 1000;

export const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: 0,
      },
      queries: {
        gcTime: GC_TIME,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retry: 1,
        staleTime: STALE_TIME,
      },
    },
  });
};

// Singleton para el cliente
let browserQueryClient: QueryClient | null = null;

export const getQueryClient = () => {
  if (typeof window === 'undefined') {
    // Servidor: siempre crear nuevo cliente
    return makeQueryClient();
  }
  // Cliente: reusar el cliente existente
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
};
