import type { QueryClient } from '@tanstack/react-query';

export function isModuleUnavailable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'module_unavailable'
  );
}

/**
 * Ejecuta `fn`; si la api responde `module_unavailable`, invalida `['modules']` para que la
 * web vuelva a consultar el estado sin esperar los 60 s, y relanza el error (P-2).
 */
export async function withModuleInvalidation<T>(
  queryClient: QueryClient,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isModuleUnavailable(error)) {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    }
    throw error;
  }
}

const NO_RETRY_CODES = ['module_unavailable', 'document_not_found', 'permission_denied'];

/** Política de reintento de las consultas de docs: nada de reintentar 404, 403 ni `module_unavailable`. */
export function shouldRetryDocsQuery(count: number, error: unknown): boolean {
  const { code, status } = (error ?? {}) as { code?: string; status?: number };
  if (status === 404 || status === 403 || (code && NO_RETRY_CODES.includes(code))) return false;
  return count < 1;
}
