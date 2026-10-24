import type { DocsError, DocsResult } from '../types/docs.types';

const isDocsError = (value: unknown): value is DocsError =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as DocsError).code === 'string' &&
  typeof (value as DocsError).message === 'string';

/**
 * Convierte lo que lance `fn` en un `DocsResult` (P-2). El `ApiError` del interceptor se
 * conserva entero (`code`, `status`, `details`); cualquier otra excepción pasa a `internal_error`.
 */
export async function toResult<T>(fn: () => Promise<T>): Promise<DocsResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (isDocsError(error)) {
      const { code, message, status, details } = error as DocsError;
      return {
        ok: false,
        error: { code, message, status: status ?? 500, ...(details ? { details } : {}) },
      };
    }
    return {
      ok: false,
      error: { code: 'internal_error', message: 'Internal error', status: 500 },
    };
  }
}

/** Del lado del navegador: re-lanza el `DocsError` para que `useQuery`/`useMutation` lo traten como error. */
export function unwrap<T>(result: DocsResult<T>): T {
  if (result.ok) return result.data;
  throw result.error;
}
