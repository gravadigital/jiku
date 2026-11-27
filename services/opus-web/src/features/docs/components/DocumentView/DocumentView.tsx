'use client';

import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Spinner } from '@/shared/components/ui';
import type { ApiError } from '@/lib/axios';
import { MSG_DOCS_UNAVAILABLE } from '../../constants/docs.constants';
import { useDocument } from '../../hooks/useDocument';
import { useModule, useModules } from '../../hooks/useModules';
import { classifyDocumentError } from '../../utils/classifyDocumentError';
import { formatDocDate } from '../../utils/dates';
import { DocsAlert } from '../DocsAlert';
import { DocumentAttachments } from '../DocumentAttachments';
import { DocumentHeader } from '../DocumentHeader';
import { DocumentMarkdown } from '../DocumentMarkdown';
import styles from './DocumentView.module.scss';

interface DocumentViewProps {
  projectId: number;
  documentId: string;
}

const MSG_NOT_FOUND = 'Este documento no existe o no está compartido con vos.';
const MSG_SYSTEM = 'No se pudo cargar el documento.';

/** Pantalla `documento`: lectura de solo lectura de un documento público. */
export function DocumentView({ projectId, documentId }: DocumentViewProps) {
  const modules = useModules();
  const { status, isKnown } = useModule('docs');
  const document = useDocument({
    documentId,
    enabled: isKnown && status === 'available',
  });

  const retry = () => {
    void modules.refetch();
    void document.refetch();
  };

  const exception = (body: ReactNode, withRetry: boolean) => (
    <div className={styles.page}>
      <DocumentHeader projectId={projectId} />
      <div className={styles.centered}>
        {body}
        {withRetry ? (
          <Button variant="primary" onClick={retry}>
            <RefreshCw size={14} aria-hidden="true" /> Reintentar
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (modules.isLoading || document.isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.centered}>
          <Spinner size="lg" />
          <p className={styles.loadingText}>Cargando documento...</p>
        </div>
      </div>
    );
  }

  if (modules.isError) {
    return exception(<DocsAlert variant="error">{MSG_SYSTEM}</DocsAlert>, true);
  }

  if (status === 'not_installed') {
    return exception(<DocsAlert variant="error">{MSG_NOT_FOUND}</DocsAlert>, false);
  }

  if (status === 'unavailable') {
    return exception(<DocsAlert variant="warning">{MSG_DOCS_UNAVAILABLE}</DocsAlert>, true);
  }

  if (document.isError) {
    const kind = classifyDocumentError(document.error as unknown as ApiError);
    if (kind === 'not_found') {
      return exception(<DocsAlert variant="error">{MSG_NOT_FOUND}</DocsAlert>, false);
    }
    if (kind === 'unavailable') {
      return exception(<DocsAlert variant="warning">{MSG_DOCS_UNAVAILABLE}</DocsAlert>, true);
    }
    return exception(<DocsAlert variant="error">{MSG_SYSTEM}</DocsAlert>, true);
  }

  const doc = document.data;
  if (!doc) return exception(<DocsAlert variant="error">{MSG_SYSTEM}</DocsAlert>, true);

  const hasAttachments = (doc.attachments?.length ?? 0) > 0;

  return (
    <div className={styles.page}>
      <DocumentHeader projectId={projectId} title={doc.title} />
      <div className={styles.scroll}>
        <div className={styles.body} data-with-attachments={hasAttachments}>
          <article className={styles.article}>
            <h1 className={styles.title}>{doc.title}</h1>
            <p className={styles.date}>Actualizado el {formatDocDate(doc.updatedAt)}</p>
            <DocumentMarkdown documentId={doc.id} content={doc.content ?? ''} />
          </article>
          <DocumentAttachments documentId={doc.id} attachments={doc.attachments} />
        </div>
      </div>
    </div>
  );
}
