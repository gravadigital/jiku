'use client';

import React from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Card, EmptyState, Loader, Pagination, Table } from '@/shared/components/ui';
import { DocsNotice } from '../DocsNotice';
import { toDocumentRow, type DocsRowModel, type RowLayout } from '../DocumentRow';
import styles from './DocsResults.module.scss';
import { pageOfTextResults, TEXT_PAGE_SIZE } from './textResults';
import type { DocsOrder } from '../../utils/docsSearchParams';
import type { TableColumn } from '@/shared/components/ui/Table';

const LOADING_MESSAGE = 'Cargando documentación…';
const LIST_ERROR = 'No se pudo cargar la documentación. Actualizá la página.';
const SEARCH_ERROR = 'No se pudo buscar. Intentá de nuevo.';
const EMPTY_HOME = 'Todavía no hay documentos. Creá el primero con «Nuevo documento».';
const EMPTY_FILTERED = 'Ningún documento cumple estos filtros. Quitá alguno o probá con otras palabras.';
const EMPTY_SIN_PROYECTO = 'Todos los documentos tienen proyecto.';

interface DocsResultsProps {
  readonly mode: 'inicio' | 'listado' | 'texto';
  readonly layout: RowLayout;
  /** Inicio: los dos grupos. */
  readonly mine?: readonly DocsRowModel[];
  readonly recent?: readonly DocsRowModel[];
  /**
   * Listado: ya es la página visible. Texto: todos los resultados (hasta 50); el orden y la
   * página de 20 se aplican acá, en memoria.
   */
  readonly items?: readonly DocsRowModel[];
  /** Total de un listado (`page.total`). */
  readonly total?: number;
  readonly orden: DocsOrder;
  readonly pagina: number;
  readonly onPageChange: (page: number) => void;
  readonly isLoading: boolean;
  readonly error?: unknown;
  readonly q: string;
  readonly renderTitleExtra?: (row: DocsRowModel) => React.ReactNode;
  readonly renderAction?: (row: DocsRowModel) => React.ReactNode;
}

const columnsFor = (layout: RowLayout, firstLabel: string): TableColumn[] => {
  switch (layout) {
    case 'sinProyecto':
      return [
        { key: 'title', label: firstLabel },
        { key: 'client', label: 'Cliente' },
        { key: 'updatedAt', label: 'Actualizado' },
        { key: 'action', label: 'Acción' },
      ];
    case 'temas':
      return [
        { key: 'title', label: firstLabel },
        { key: 'topics', label: 'Temas' },
        { key: 'updatedAt', label: 'Actualizado' },
        { key: 'by', label: 'Editado por' },
      ];
    default:
      return [
        { key: 'title', label: firstLabel },
        { key: 'clientProject', label: 'Cliente · Proyecto' },
        { key: 'updatedAt', label: 'Actualizado' },
        { key: 'by', label: 'Editado por' },
      ];
  }
};

export function DocsResults({
  mode,
  layout,
  mine = [],
  recent = [],
  items = [],
  total,
  orden,
  pagina,
  onPageChange,
  isLoading,
  error,
  q,
  renderTitleExtra,
  renderAction,
}: DocsResultsProps) {
  const currentUser = useCurrentUser();
  const ctx = {
    layout,
    currentUserId: currentUser?.id ?? null,
    // Una sola vez por render: todas las filas se comparan con el mismo instante.
    now: new Date(),
    q: mode === 'texto' ? q : undefined,
    renderTitleExtra,
    renderAction,
  };
  const toRows = (rows: readonly DocsRowModel[]) => rows.map((row) => toDocumentRow(row, ctx));

  const renderBody = (): { body: React.ReactNode; live: string; footer?: React.ReactNode } => {
    if (error) {
      return {
        body: <DocsNotice intent="error">{mode === 'texto' ? SEARCH_ERROR : LIST_ERROR}</DocsNotice>,
        live: '',
      };
    }
    if (isLoading) {
      return { body: <Loader variant="block" label={LOADING_MESSAGE} />, live: '' };
    }

    if (mode === 'inicio') {
      if (mine.length === 0 && recent.length === 0) {
        return { body: <EmptyState variant="list" message={EMPTY_HOME} />, live: 'Sin resultados' };
      }
      const groups = [
        { label: 'En mis proyectos activos', rows: mine },
        { label: 'Editados recientemente', rows: recent },
      ].filter((group) => group.rows.length > 0);
      return {
        body: (
          <div className={styles.groups}>
            {groups.map((group) => (
              <section key={group.label} className={styles.group}>
                {/* DS gap: `Table` no tiene grupos de filas; rótulo visible, no h2. */}
                <p className={styles.groupLabel}>{group.label}</p>
                <Table
                  variant="light"
                  columns={columnsFor(layout, 'Documento')}
                  rows={toRows(group.rows)}
                  ariaLabel={group.label}
                />
              </section>
            ))}
          </div>
        ),
        live: `${mine.length + recent.length} documentos`,
      };
    }

    const isText = mode === 'texto';
    const visible = isText ? pageOfTextResults(items, orden, pagina) : items;
    const count = isText ? items.length : (total ?? items.length);

    if (visible.length === 0) {
      return {
        body: (
          <EmptyState
            variant="filtered"
            message={layout === 'sinProyecto' ? EMPTY_SIN_PROYECTO : EMPTY_FILTERED}
          />
        ),
        live: 'Sin resultados',
      };
    }

    const totalLabel = isText && items.length >= 50 ? '50+' : String(count);
    return {
      body: (
        <Table
          variant="light"
          columns={columnsFor(layout, `Documento · ${visible.length} de ${totalLabel}`)}
          rows={toRows(visible)}
          ariaLabel="Documentos"
        />
      ),
      live: `${count} documentos`,
      footer: (
        <Pagination
          currentPage={pagina}
          totalItems={count}
          limit={TEXT_PAGE_SIZE}
          onPageChange={onPageChange}
        />
      ),
    };
  };

  const { body, live, footer } = renderBody();

  return (
    <Card variant="panel">
      <div className={styles.content}>
        <p className={styles.srOnly} aria-live="polite">
          {live}
        </p>
        {body}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </Card>
  );
}
