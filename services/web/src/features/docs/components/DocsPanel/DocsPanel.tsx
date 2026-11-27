'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, EmptyState, Loader } from '@/shared/components/ui';
import { useDocsCard } from '../../hooks/useDocsCard';
import { useModule } from '../../hooks/useModules';
import { cardFilters, cardInitial, countLabel, seeAllHref } from '../../utils/docsCard';
import { DOCS_UNAVAILABLE_MESSAGE } from '../../utils/docsErrors';
import { DocsNotice } from '../DocsNotice';
import { DocumentRowCompact } from '../DocumentRowCompact';
import { NewDocumentDialog } from '../NewDocumentDialog';
import styles from './DocsPanel.module.scss';
import type { DocsCardContext, DocsScope } from '../../utils/docsCard';

export type { DocsCardContext, DocsScope };

interface DocsPanelProps {
  readonly scope: DocsScope;
  /** Relaciones de la ficha que el "+" precarga y la card no deduce del `scope`. */
  readonly context?: DocsCardContext;
}

const TITLE = 'Documentación';
const LIST_LABEL = 'Documentos vinculados';

function targetOf(scope: DocsScope): string {
  if ('projectId' in scope) return 'proyecto';
  if ('requirementId' in scope) return 'requisito';
  return 'tarea';
}

function emptyMessage(scope: DocsScope): string {
  const target = 'taskId' in scope ? 'esta tarea' : `este ${targetOf(scope)}`;
  return `No hay documentos vinculados a ${target}.`;
}

function newDocumentLabel(scope: DocsScope): string {
  const target = 'taskId' in scope ? 'esta tarea' : `este ${targetOf(scope)}`;
  return `Nuevo documento en ${target}`;
}

export function DocsPanel({ scope, context }: DocsPanelProps) {
  const { status } = useModule('docs');
  const installed = status !== 'not_installed';
  const available = status === 'available';
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError } = useDocsCard({
    filters: cardFilters(scope),
    enabled: available,
  });

  // Los montajes pasan objetos literales: se memoiza por primitivos para que el `initial` del
  // diálogo no cambie de referencia en cada render.
  const scopeId =
    'projectId' in scope
      ? scope.projectId
      : 'requirementId' in scope
        ? scope.requirementId
        : scope.taskId;
  const scopeKind = targetOf(scope);
  const { clientId, projectId, title } = context ?? {};
  const initial = useMemo(
    () => cardInitial(scope, { clientId, projectId, title }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `scope` se resume en scopeKind + scopeId
    [scopeKind, scopeId, clientId, projectId, title]
  );

  if (!installed) return null;

  const failed = !available || isError;
  const items = data?.items ?? [];
  const count = !failed && data ? countLabel(data.page) : null;

  const renderBody = () => {
    if (failed) return <DocsNotice intent="warning">{DOCS_UNAVAILABLE_MESSAGE}</DocsNotice>;
    if (isLoading) return <Loader variant="inline" />;
    if (items.length === 0) return <EmptyState variant="list" message={emptyMessage(scope)} />;
    return (
      <ul className={styles.list} aria-label={LIST_LABEL}>
        {items.map((doc) => (
          <DocumentRowCompact key={doc.id} doc={doc} showIndirect={'projectId' in scope} />
        ))}
      </ul>
    );
  };

  return (
    <>
      <Card
        variant="panel"
        headingLevel="h2"
        header={
          <>
            <h2 className={styles.cardTitle}>
              {TITLE}
              {count !== null && <span className={styles.count}>{count}</span>}
            </h2>
            <div className={styles.actions}>
              <Button variant="secondary-dismiss" disabled={failed} onClick={() => setOpen(true)}>
                <span aria-hidden="true">+</span>
                <span className={styles.srOnly}>{newDocumentLabel(scope)}</span>
              </Button>
              {!failed && items.length > 0 && (
                <Link href={seeAllHref(scope)} className={styles.seeAll}>
                  Ver todos <span aria-hidden="true">›</span>
                </Link>
              )}
            </div>
          </>
        }
      >
        {renderBody()}
      </Card>
      {available && (
        <NewDocumentDialog open={open} initial={initial} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
