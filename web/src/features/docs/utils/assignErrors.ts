import { codeOf } from './docsErrors';

export const assignSuccessMessage = (project: string, title: string): string =>
  `Asignaste «${project}» a «${title}».`;

export interface AssignToast {
  level: 'warning' | 'error';
  message: string;
}

/** `code` de `relations.update` → toast de la fila (Flow Context, manejo de errores). */
export function assignErrorToast(error: unknown): AssignToast {
  switch (codeOf(error)) {
    case 'version_conflict':
      return { level: 'warning', message: 'El documento cambió; se actualizó la fila.' };
    case 'document_locked': {
      const holder = (error as { details?: { holderName?: unknown } } | null)?.details?.holderName;
      const who = typeof holder === 'string' && holder.trim() ? holder : 'Otra persona';
      return { level: 'error', message: `${who} lo está editando; probá en unos minutos.` };
    }
    case 'invalid_relation':
      return { level: 'error', message: 'Ese proyecto no se puede asignar.' };
    default:
      // Incluye `gateway_timeout` y `permission_denied`.
      return { level: 'error', message: 'No se pudo asignar el proyecto. Intentá de nuevo.' };
  }
}
