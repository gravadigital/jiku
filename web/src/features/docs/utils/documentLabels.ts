import { formatDateTime } from './dates';
import { editorLabel } from './editorLabel';
import type { DocsVersion, DocsVisibility } from '../types/docs.types';

export const titleOf = (doc: { title?: string | null }): string =>
  doc.title?.trim() || 'Sin título';

const VISIBILITY_LABELS: Record<DocsVisibility, string> = {
  internal: 'Interno',
  public: 'Visible para el cliente',
  restricted: 'Restringido',
};

export const visibilityLabel = (visibility: DocsVisibility): string =>
  VISIBILITY_LABELS[visibility];

interface MetaSource {
  version: number;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string | null;
}

/** El nombre es el que manda el servicio; sin nombre se omite el `"por —"`. */
export function metaVersionLabel(doc: MetaSource, currentUserId?: string | null): string {
  const base = `Versión ${doc.version} · actualizado ${formatDateTime(doc.updatedAt)}`;
  const who = editorLabel({ name: doc.updatedByName, sub: doc.updatedBy, currentUserId });
  return who === '—' ? base : `${base} por ${who}`;
}

const KIND_LABELS: Record<DocsVersion['kind'], string> = {
  create: 'Creación',
  update: 'Edición',
  restore: 'Restauración',
};

export const versionKindLabel = (kind: DocsVersion['kind']): string => KIND_LABELS[kind];

export function prunedLabel(count?: number): string | null {
  if (!count || count < 1) return null;
  return count === 1
    ? '1 versión intermedia compactada.'
    : `${count} versiones intermedias compactadas.`;
}
