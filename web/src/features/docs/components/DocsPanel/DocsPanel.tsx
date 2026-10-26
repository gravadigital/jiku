'use client';

import React from 'react';
import Link from 'next/link';
import { usePersons } from '@/features/auth/hooks/usePersons';
import { Badge, Button, Card, EmptyState, Loader, Table } from '@/shared/components/ui';
import { labelFromDate } from '@/shared/utils/dateFormatter';
import { useDocuments } from '../../hooks/useDocuments';
import { useModule } from '../../hooks/useModules';
import { folderPathOf, displayTitle } from '../../utils/paths';
import { personName } from '../../utils/persons';
import { DocsNotice } from '../DocsNotice';
import styles from './DocsPanel.module.scss';
import type { DocsDocument } from '../../types/docs.types';
import type { TableColumn, TableRow } from '@/shared/components/ui/Table';

export type DocsScope = { projectId: number } | { requirementId: number } | { taskId: number };

interface DocsPanelProps {
  readonly scope: DocsScope;
}

const UNAVAILABLE_MESSAGE =
  'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.';

const COLUMNS: readonly TableColumn[] = [
  { key: 'title', label: 'Documento' },
  { key: 'path', label: 'Ruta' },
  { key: 'updatedAt', label: 'Actualizado' },
];

function emptyMessage(scope: DocsScope): string {
  let target = 'esta tarea';
  if ('projectId' in scope) target = 'este proyecto';
  else if ('requirementId' in scope) target = 'este requisito';
  return `No hay documentos vinculados a ${target}.`;
}

const hasActiveLock = (doc: DocsDocument): boolean =>
  Boolean(doc.lock) && new Date(doc.lock!.expiresAt) > new Date();

export function DocsPanel({ scope }: DocsPanelProps) {
  const { status } = useModule('docs');
  const installed = status !== 'not_installed';
  const available = status === 'available';

  // El contrato 1.3.0 acepta una lista de proyectos: el panel manda uno solo.
  const filters = 'projectId' in scope ? { projectId: [scope.projectId] } : scope;
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useDocuments(
    { filters, enabled: available }
  );

  const documents = data?.pages.flatMap((page) => page.items) ?? [];
  const anyLock = documents.some(hasActiveLock);
  const { data: persons } = usePersons({ enabled: available && anyLock });

  if (!installed) return null;

  const renderBody = () => {
    if (!available || isError) {
      return <DocsNotice intent="warning">{UNAVAILABLE_MESSAGE}</DocsNotice>;
    }
    if (isLoading) {
      return <Loader variant="inline" />;
    }
    if (documents.length === 0) {
      return <EmptyState variant="list" message={emptyMessage(scope)} />;
    }

    const rows: TableRow[] = documents.map((doc) => ({
      title: (
        <span className={styles.titleCell}>
          <Link href={`/docs/${doc.id}`} className={styles.titleLink}>
            {displayTitle(doc)}
          </Link>
          {hasActiveLock(doc) && (
            <>
              <span aria-hidden="true">
                <Badge variant="outline" family="neutral" label="En edición" />
              </span>
              <span className={styles.srOnly}>
                {personName(persons, doc.lock!.holder)} lo está editando
              </span>
            </>
          )}
        </span>
      ),
      path: folderPathOf(doc.path),
      updatedAt: labelFromDate(new Date(doc.updatedAt), 'DD/MM/YYYY'),
    }));

    return (
      <div className={styles.content}>
        <Table variant="light" columns={COLUMNS} rows={rows} ariaLabel="Documentos vinculados" />
        {hasNextPage && (
          <Button
            variant="secondary-dismiss"
            loading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Ver más
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card variant="panel" title="Documentación" headingLevel="h2">
      {renderBody()}
    </Card>
  );
}
