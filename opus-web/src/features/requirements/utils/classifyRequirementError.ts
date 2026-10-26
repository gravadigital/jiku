import type { ApiError } from '@/lib/axios';

export type RequirementErrorKind = 'not_found' | 'system';

/**
 * Clasifica el error de carga de un requisito (REQ-020 DD-7).
 *
 * 403 y 404 (o sus `code`) son `not_found`: la api los iguala a propósito, así que no se distingue
 * "no existe" de "sin permiso" (mismo criterio que `classifyDocumentError`, DD-3 de REQ-016).
 * Todo lo demás es `system`; un fallo de red llega del interceptor como `status: 500` /
 * `unknown_error`, así que también cae acá. Un error `null`/`undefined` es `system`.
 */
export function classifyRequirementError(
  error: Partial<Pick<ApiError, 'status' | 'code'>> | null | undefined
): RequirementErrorKind {
  if (
    error?.status === 403 ||
    error?.status === 404 ||
    error?.code === 'requirement_not_found' ||
    error?.code === 'access_denied'
  ) {
    return 'not_found';
  }
  return 'system';
}
