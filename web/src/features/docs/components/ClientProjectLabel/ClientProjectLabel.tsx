import React from 'react';
import type { DocsClientRef, DocsProjectRef } from '../../types/docs.types';

interface ClientProjectLabelProps {
  readonly clientRefs?: readonly DocsClientRef[];
  readonly projectRefs?: readonly DocsProjectRef[];
  readonly clients?: readonly number[];
  readonly projects?: readonly number[];
  readonly show?: 'both' | 'client';
}

const labelOf = (
  ref: { id: number; name: string | null } | undefined,
  ids: readonly number[] | undefined,
  empty: string
): string => {
  if (ref) return ref.name ?? `#${ref.id}`;
  const id = ids?.[0];
  return id === undefined ? empty : `#${id}`;
};

/** Primer cliente y primer proyecto del documento (el primero es el principal); `#id` si no hay nombre. */
export function ClientProjectLabel({
  clientRefs,
  projectRefs,
  clients,
  projects,
  show = 'both',
}: ClientProjectLabelProps) {
  const client = labelOf(clientRefs?.[0], clients, 'Sin cliente');
  if (show === 'client') return <>{client}</>;
  const project = labelOf(projectRefs?.[0], projects, 'Sin proyecto');
  return <>{`${client} · ${project}`}</>;
}
