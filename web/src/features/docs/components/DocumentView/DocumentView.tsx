'use client';

import React from 'react';
import { notFound } from 'next/navigation';
import { usePersons } from '@/features/auth/hooks/usePersons';
import { Button, Card, Loader, ViewHeader } from '@/shared/components/ui';
import { useDocument } from '../../hooks/useDocument';
import { useModule } from '../../hooks/useModules';
import { formatDateTime } from '../../utils/dates';
import { displayTitle } from '../../utils/paths';
import { personName } from '../../utils/persons';
import { DocsNotice } from '../DocsNotice';
import { DocumentBreadcrumb } from '../DocumentBreadcrumb';
import { DocumentContent } from '../DocumentContent';
import { DocumentRelations } from '../DocumentRelations';
import styles from './DocumentView.module.scss';

interface DocumentViewProps {
  readonly id: string;
}

const UNAVAILABLE_MESSAGE =
  'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.';
const NOT_FOUND_MESSAGE = 'Este documento no existe o no tenés permiso para verlo.';

const UNAVAILABLE_CODES = [
  'module_unavailable',
  'upstream_unavailable',
  'content_unavailable',
  'gateway_timeout',
  'query_timeout',
];

interface ErrorLike {
  code?: string;
  status?: number;
}

const BackButton = ({ href }: { href: string }) => (
  <Button variant="secondary-nav" href={href}>
    Volver
  </Button>
);

export function DocumentView({ id }: DocumentViewProps) {
  const { status, isKnown } = useModule('docs');
  const {
    data: doc,
    isError,
    error,
  } = useDocument({
    id,
    enabled: status !== 'not_installed',
  });
  const { data: persons } = usePersons({ enabled: Boolean(doc) });

  // El módulo se dio de baja con la página abierta (CA-S11): la ruta deja de existir.
  if (isKnown && status === 'not_installed') {
    notFound();
  }

  const err = (isError ? error : null) as ErrorLike | null;
  const moduleDown =
    status === 'unavailable' || Boolean(err?.code && UNAVAILABLE_CODES.includes(err.code));
  const isNotFoundError = err?.code === 'document_not_found' || err?.status === 404;

  if (!doc) {
    let body: React.ReactNode;
    if (moduleDown) {
      body = <DocsNotice intent="warning">{UNAVAILABLE_MESSAGE}</DocsNotice>;
    } else if (err && isNotFoundError) {
      body = <DocsNotice intent="error">{NOT_FOUND_MESSAGE}</DocsNotice>;
    } else if (err) {
      // Otro fallo: nunca se muestra como "no existe" ni como vacío.
      body = <DocsNotice intent="warning">{UNAVAILABLE_MESSAGE}</DocsNotice>;
    } else {
      body = <Loader variant="block" label="Cargando documento…" />;
    }

    return (
      <div className={styles.page}>
        <div className={styles.stateActions}>
          <BackButton href="/docs" />
        </div>
        {body}
      </div>
    );
  }

  const folderHref = `/docs?folder=${doc.folder.id}`;
  const visibilityLabel = doc.visibility === 'public' ? 'Visible para el cliente' : 'Interno';
  const attachments = doc.attachments ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {/* Va primero en el DOM para respetar el orden de foco de la UX (Volver → aviso → contenido). */}
        <div className={styles.actions}>
          <BackButton href={folderHref} />
        </div>
        <div className={styles.heading}>
          <DocumentBreadcrumb folder={doc.folder} />
          <ViewHeader
            variant="detail"
            title={displayTitle(doc)}
            badges={[{ variant: 'outline', family: 'neutral', label: visibilityLabel }]}
          />
          <p className={styles.meta}>
            {`Versión ${doc.version} · actualizado el ${formatDateTime(doc.updatedAt)} por ${personName(persons, doc.updatedBy)}`}
          </p>
        </div>
      </div>

      {moduleDown && <DocsNotice intent="warning">{UNAVAILABLE_MESSAGE}</DocsNotice>}

      <div className={styles.reading}>
        <div className={styles.main}>
          <Card variant="panel">
            <DocumentContent content={doc.content ?? ''} />
          </Card>
        </div>
        <div className={styles.side}>
          <DocumentRelations relations={doc.relations} topics={doc.topics} />
          <Card variant="panel" title="Adjuntos" headingLevel="h2">
            {attachments.length === 0 ? (
              <p className={styles.empty}>Sin adjuntos.</p>
            ) : (
              <ul className={styles.attachments}>
                {attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      href={`/docs/attachments/${attachment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.attachmentLink}
                    >
                      {attachment.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
