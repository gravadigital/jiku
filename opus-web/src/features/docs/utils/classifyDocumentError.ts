import type { ApiError } from '@/lib/axios';

export type DocumentErrorKind = 'not_found' | 'unavailable' | 'system';

/**
 * Clasifica el error del detalle por status (P-4): 404/403 → no existe o no compartido (mismo
 * mensaje, DD-3); 503 → módulo no disponible; cualquier otro → fallo de sistema.
 */
export function classifyDocumentError(
  error: Pick<ApiError, 'status'> | null | undefined
): DocumentErrorKind {
  const status = error?.status;
  if (status === 404 || status === 403) return 'not_found';
  if (status === 503) return 'unavailable';
  return 'system';
}
