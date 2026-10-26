import React from 'react';
import Link from 'next/link';
import { Badge } from '@/shared/components/ui';
import { formatDay } from '../../utils/dates';
import { editorLabel } from '../../utils/editorLabel';
import { isLockActive } from '../../utils/lockState';
import { ClientProjectLabel } from '../ClientProjectLabel';
import { SearchSnippet } from '../SearchSnippet';
import { TopicPills } from '../TopicPills';
import { VisibilityPill } from '../VisibilityPill';
import styles from './DocumentRow.module.scss';
import type {
  DocsClientRef,
  DocsDocument,
  DocsLock,
  DocsProjectRef,
  DocsSearchHit,
  DocsVisibility,
} from '../../types/docs.types';
import type { TableRow } from '@/shared/components/ui/Table';

/** Lo que la fila necesita de un `DocsDocument` (listado) o de un `DocsSearchHit` (texto). */
export interface DocsRowModel {
  id: string;
  version: number;
  title: string;
  clients?: number[];
  projects?: number[];
  clientRefs?: DocsClientRef[];
  projectRefs?: DocsProjectRef[];
  topics?: string[];
  visibility?: DocsVisibility;
  lock?: DocsLock | null;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string | null;
  snippet?: string;
}

export const toRowModel = (item: DocsDocument | DocsSearchHit): DocsRowModel => {
  const isHit = 'documentId' in item;
  return {
    id: isHit ? item.documentId : item.id,
    version: item.version,
    title: item.title,
    clients: item.clients,
    projects: item.projects,
    clientRefs: item.clientRefs,
    projectRefs: item.projectRefs,
    topics: isHit ? undefined : item.topics,
    visibility: item.visibility,
    lock: isHit ? undefined : item.lock,
    updatedAt: item.updatedAt,
    updatedBy: item.updatedBy,
    updatedByName: item.updatedByName,
    snippet: isHit ? item.snippet : undefined,
  };
};

/** Qué columnas lleva la tabla: la general, la de un proyecto (con temas) o "Sin proyecto". */
export type RowLayout = 'default' | 'temas' | 'sinProyecto';

export interface RowContext {
  layout: RowLayout;
  currentUserId: string | null;
  now: Date;
  /** Texto buscado: con él, el fragmento se muestra debajo del título. */
  q?: string;
  /** Debajo del título (la sugerencia de proyecto, en "Sin proyecto"). */
  renderTitleExtra?: (row: DocsRowModel) => React.ReactNode;
  /** Última columna en "Sin proyecto". */
  renderAction?: (row: DocsRowModel) => React.ReactNode;
}

const FileIcon = () => (
  <span className={styles.icon} aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" focusable="false">
      <path
        d="M4 1.5h5l3.5 3.5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11.5a1 1 0 0 1 1-1Zm5 0V5h3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

interface DocumentTitleCellProps {
  readonly row: DocsRowModel;
  readonly ctx: RowContext;
}

export function DocumentTitleCell({ row, ctx }: DocumentTitleCellProps) {
  const locked = isLockActive(row.lock, ctx.now, null);
  const holder = row.lock?.holderName?.trim();
  return (
    <span className={styles.cell}>
      <span className={styles.titleLine}>
        <FileIcon />
        <Link href={`/docs/${row.id}`} className={styles.link}>
          {row.title}
        </Link>
        {ctx.layout !== 'temas' && <TopicPills topics={row.topics} />}
        <VisibilityPill visibility={row.visibility} />
        {locked && (
          <>
            <span aria-hidden="true">
              <Badge variant="outline" family="neutral" label="En edición" />
            </span>
            <span className={styles.srOnly}>
              {holder ? `${holder} lo está editando` : 'Otra persona lo está editando'}
            </span>
          </>
        )}
      </span>
      {row.snippet && ctx.q && <SearchSnippet snippet={row.snippet} q={ctx.q} />}
      {ctx.renderTitleExtra?.(row)}
    </span>
  );
}

export function toDocumentRow(row: DocsRowModel, ctx: RowContext): TableRow {
  const base: TableRow = {
    title: <DocumentTitleCell row={row} ctx={ctx} />,
    updatedAt: <span className={styles.mono}>{formatDay(row.updatedAt)}</span>,
  };
  const labelProps = {
    clientRefs: row.clientRefs,
    projectRefs: row.projectRefs,
    clients: row.clients,
    projects: row.projects,
  };
  const by = editorLabel({
    name: row.updatedByName,
    sub: row.updatedBy,
    currentUserId: ctx.currentUserId,
  });

  switch (ctx.layout) {
    case 'sinProyecto':
      return {
        ...base,
        client: <ClientProjectLabel {...labelProps} show="client" />,
        action: <span className={styles.action}>{ctx.renderAction?.(row)}</span>,
      };
    case 'temas':
      return { ...base, topics: <TopicPills topics={row.topics} emptyLabel="Sin tema" />, by };
    default:
      return { ...base, clientProject: <ClientProjectLabel {...labelProps} />, by };
  }
}
