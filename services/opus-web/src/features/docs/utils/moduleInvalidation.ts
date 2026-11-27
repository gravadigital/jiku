import type { QueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/lib/axios';

export function isModuleUnavailable(error: unknown): boolean {
  return (error as Partial<ApiError> | null)?.code === 'module_unavailable';
}

/**
 * Ante `module_unavailable` invalida el estado del módulo (vive en memoria por réplica y se
 * refresca cada 60 s; con la señal explícita no hay por qué esperar) y relanza el error.
 */
export async function withModuleInvalidation<T>(
  queryClient: QueryClient,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isModuleUnavailable(error)) {
      void queryClient.invalidateQueries({ queryKey: ['modules'] });
    }
    throw error;
  }
}
