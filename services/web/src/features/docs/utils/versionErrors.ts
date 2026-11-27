import { DOCS_UNAVAILABLE_MESSAGE, codeOf } from './docsErrors';
import { lockHolderLabel } from './lockState';
import type { DocsVersionPrunedDetails } from '../types/docs.types';

/** Solo enteros >= 1 sin ceros a la izquierda; cualquier otro valor se ignora. */
export function parseVersionParam(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function prunedDetailsOf(error: unknown): DocsVersionPrunedDetails | null {
  if (codeOf(error) !== 'version_pruned') return null;
  const details = (error as { details?: Partial<DocsVersionPrunedDetails> }).details;
  return typeof details?.requestedVersion === 'number'
    ? (details as DocsVersionPrunedDetails)
    : null;
}

export function describeRestoreError(error: unknown, version: number): string {
  switch (codeOf(error)) {
    case 'version_conflict':
      return 'El documento cambió mientras restaurabas; actualizamos el historial.';
    case 'version_pruned':
      return `La versión ${version} ya no se conserva.`;
    case 'document_locked': {
      const details = (error as { details?: { holderName?: unknown; via?: unknown } }).details;
      const holderName = typeof details?.holderName === 'string' ? details.holderName : null;
      return `${lockHolderLabel({ holderName, via: details?.via === 'agent' ? 'agent' : 'human' })} lo está editando.`;
    }
    case 'module_unavailable':
      return DOCS_UNAVAILABLE_MESSAGE;
    default:
      return `No se pudo restaurar la versión ${version}. Intentá de nuevo.`;
  }
}
