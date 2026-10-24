import { codeOf, DOCS_UNAVAILABLE_MESSAGE } from './docsErrors';

export const SHARES_LOAD_FAILED_MESSAGE = 'No se pudieron cargar los links.';

export interface CreateShareFailure {
  state?: 'secret' | 'blocked';
  field?: string;
  notice?: string;
}

/** P-6: mapeo `code` → estado, error de campo o aviso del diálogo O-12. */
export function describeCreateShareError(error: unknown): CreateShareFailure {
  switch (codeOf(error)) {
    case 'secret_warning_not_acknowledged':
      return { state: 'secret' };
    case 'sharing_blocked':
      return { state: 'blocked' };
    case 'share_expiry_invalid':
      return { field: 'El vencimiento no es válido. Elegí entre 7 y 180 días.' };
    case 'sharing_not_configured':
      return { notice: 'Compartir no está habilitado en esta instalación.' };
    case 'module_unavailable':
      return { notice: DOCS_UNAVAILABLE_MESSAGE };
    case 'permission_denied':
      return { notice: 'No tenés permiso para compartir este documento.' };
    default:
      return { notice: 'No se pudo crear el link. Intentá de nuevo.' };
  }
}

/** P-10: `null` = sin mensaje (el hook ya refrescó la lista). */
export function revokeShareErrorMessage(error: unknown): string | null {
  switch (codeOf(error)) {
    case 'share_not_found':
      return null;
    case 'module_unavailable':
      return DOCS_UNAVAILABLE_MESSAGE;
    default:
      return 'No se pudo revocar el link. Intentá de nuevo.';
  }
}
