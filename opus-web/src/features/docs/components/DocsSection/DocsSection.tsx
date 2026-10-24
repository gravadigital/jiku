'use client';

import { useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, FileText } from 'lucide-react';
import { Button, Spinner } from '@/shared/components/ui';
import type { ApiError } from '@/lib/axios';
import { MSG_DOCS_UNAVAILABLE } from '../../constants/docs.constants';
import { useDocuments } from '../../hooks/useDocuments';
import { useModule } from '../../hooks/useModules';
import { formatDocDate } from '../../utils/dates';
import { DocsAlert } from '../DocsAlert';
import styles from './DocsSection.module.scss';

interface DocsSectionProps {
  projectId: number;
  /** Con requisito, lista los documentos vinculados a él; sin él, los del proyecto. */
  requirementId?: number;
}

/**
 * Sección colapsable "Documentación (n)" del portal (tablero y detalle de requisito).
 * Con el módulo no instalado, con 0 documentos o mientras se desconoce el estado no
 * renderiza nada; con el módulo caído aparece con el aviso.
 */
export function DocsSection({ projectId, requirementId }: DocsSectionProps) {
  const listId = useId();
  const [expanded, setExpanded] = useState(true);
  const { status, isKnown } = useModule('docs');
  const isAvailable = isKnown && status === 'available';

  const query = useDocuments({
    ...(requirementId ? { requirementId } : { projectId }),
    enabled: isAvailable,
  });

  if (!isKnown || status === 'not_installed') return null;

  const frame = (title: string, body: ReactNode, collapsible = false) => (
    <section className={styles.section} aria-label="Documentación">
      {collapsible ? (
        <button
          type="button"
          className={styles.header}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
        >
          <FileText size={16} aria-hidden="true" />
          <span className={styles.title}>{title}</span>
          <ChevronDown
            size={16}
            className={styles.chevron}
            data-expanded={expanded}
            aria-hidden="true"
          />
        </button>
      ) : (
        <h3 className={styles.heading}>
          <FileText size={16} aria-hidden="true" />
          <span className={styles.title}>{title}</span>
        </h3>
      )}
      {body}
    </section>
  );

  if (status === 'unavailable') {
    return frame('Documentación', <DocsAlert variant="warning">{MSG_DOCS_UNAVAILABLE}</DocsAlert>);
  }

  if (query.isLoading) {
    return frame('Documentación', <Spinner size="sm" />);
  }

  if (query.isError) {
    if ((query.error as unknown as ApiError | null)?.code === 'module_not_installed') return null;
    return frame('Documentación', <DocsAlert variant="warning">{MSG_DOCS_UNAVAILABLE}</DocsAlert>);
  }

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (items.length === 0) return null;

  const title = `Documentación (${items.length}${query.hasNextPage ? '+' : ''})`;

  return frame(
    title,
    expanded ? (
      <div id={listId}>
        <ul className={styles.list}>
          {items.map((doc) => (
            <li key={doc.id} className={styles.row}>
              <FileText size={16} className={styles.rowIcon} aria-hidden="true" />
              <Link href={`/projects/${projectId}/docs/${doc.id}`} className={styles.link}>
                {doc.title}
              </Link>
              <span className={styles.date}>Actualizado el {formatDocDate(doc.updatedAt)}</span>
            </li>
          ))}
        </ul>
        {query.hasNextPage ? (
          <div className={styles.more}>
            <Button
              variant="secondary"
              size="sm"
              loading={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              Ver más
            </Button>
          </div>
        ) : null}
      </div>
    ) : null,
    true
  );
}
