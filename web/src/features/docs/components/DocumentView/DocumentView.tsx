'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { notFound, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { usePersons } from '@/features/auth/hooks/usePersons';
import { Button, Card, Loader, ViewHeader } from '@/shared/components/ui';
import { useDocument } from '../../hooks/useDocument';
import { useEditSession } from '../../hooks/useEditSession';
import { useModule } from '../../hooks/useModules';
import { formatDateTime } from '../../utils/dates';
import {
  codeOf,
  PERMISSION_DENIED_MESSAGE,
  START_EDIT_FAILED_MESSAGE,
} from '../../utils/docsErrors';
import { isLockActive, lockedMessage } from '../../utils/lockState';
import { displayTitle } from '../../utils/paths';
import { personName } from '../../utils/persons';
import { DocsNotice } from '../DocsNotice';
import { DocumentBreadcrumb } from '../DocumentBreadcrumb';
import { DocumentContent } from '../DocumentContent';
import { DocumentEditor } from '../DocumentEditor';
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

const LOCK_POLL_MS = 60_000;
const MAX_TIMER_MS = 2_147_483_647;
const LARGE_MESSAGE =
  'Este documento es demasiado grande para editarlo desde acá. Podés leerlo y editarlo con jiku-go.';

const BackButton = ({ href }: { href: string }) => (
  <Button variant="secondary-nav" href={href}>
    Volver
  </Button>
);

export function DocumentView({ id }: DocumentViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, isKnown } = useModule('docs');
  // Con un bloqueo vigente se revisa cada 60 s si venció (CA-S12); el flag es estado porque
  // se deriva del propio documento que esta consulta trae.
  const [polling, setPolling] = useState(false);
  const {
    data: doc,
    isError,
    error,
  } = useDocument({
    id,
    enabled: status !== 'not_installed',
    refetchInterval: polling ? LOCK_POLL_MS : false,
  });
  const { data: persons } = usePersons({ enabled: Boolean(doc) });
  const session = useEditSession({ documentId: id });
  const [now, setNow] = useState(() => new Date());
  const editWrapRef = useRef<HTMLSpanElement>(null);
  const [focusEdit, setFocusEdit] = useState(false);
  const editParamHandled = useRef(false);

  const lockedByOther = isLockActive(doc?.lock, now, session.sessionId);
  const blockedBy =
    session.blockedBy && new Date(session.blockedBy.expiresAt) > now ? session.blockedBy : null;
  const blocked = lockedByOther || Boolean(blockedBy);
  const editing = session.phase === 'editing' || session.phase === 'lost';
  const canEdit =
    Boolean(doc) &&
    (doc?.folder.effectivePermission === 'write' || doc?.folder.effectivePermission === 'manage') &&
    !doc?.contentUrl;

  useEffect(() => {
    setPolling(lockedByOther);
  }, [lockedByOther]);

  // Cuando el bloqueo vence se vuelve a renderizar solo, sin recargar.
  const lockExpiry = doc?.lock?.expiresAt;
  const blockerExpiry = session.blockedBy?.expiresAt;
  useEffect(() => {
    const targets = [lockExpiry, blockerExpiry]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((time) => time > Date.now());
    if (targets.length === 0) return undefined;
    const delay = Math.min(Math.max(...targets) - Date.now() + 100, MAX_TIMER_MS);
    const timer = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(timer);
  }, [lockExpiry, blockerExpiry]);

  const startEditing = useCallback(async () => {
    const outcome = await session.start();
    if (outcome === 'ok' || outcome === 'locked') return;
    toast.error(
      codeOf(outcome) === 'permission_denied'
        ? PERMISSION_DENIED_MESSAGE
        : START_EDIT_FAILED_MESSAGE
    );
  }, [session]);

  // P-10: tras crear un documento se entra directo en edición (`?editar=1`) y se limpia el parámetro.
  const editParam = searchParams.get('editar') === '1';
  useEffect(() => {
    if (!editParam || !doc || editParamHandled.current) return;
    editParamHandled.current = true;
    router.replace(`/docs/${id}`);
    if (canEdit && !lockedByOther) void startEditing();
  }, [editParam, doc, canEdit, lockedByOther, id, router, startEditing]);

  // Al volver a la lectura (guardar o cancelar) el foco va a "Editar".
  useEffect(() => {
    if (!focusEdit || editing) return;
    editWrapRef.current?.querySelector('button')?.focus();
    setFocusEdit(false);
  }, [focusEdit, editing]);

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

  // Un solo aviso a la vez. Prioridad (los de conflicto y reserva perdida viven en el editor):
  // no disponible > bloqueado > documento grande.
  const renderNotice = () => {
    if (moduleDown) return <DocsNotice intent="warning">{UNAVAILABLE_MESSAGE}</DocsNotice>;
    if (editing) return null;
    if (blockedBy) {
      return <DocsNotice intent="info">{lockedMessage(blockedBy, persons)}</DocsNotice>;
    }
    if (lockedByOther && doc.lock) {
      return (
        <DocsNotice intent="info" role="none">
          {lockedMessage(doc.lock, persons)}
        </DocsNotice>
      );
    }
    if (doc.contentUrl) return <DocsNotice intent="info">{LARGE_MESSAGE}</DocsNotice>;
    return null;
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {/* Va primero en el DOM para respetar el orden de foco de la UX (Volver → aviso → contenido). */}
        <div className={styles.actions}>
          <BackButton href={folderHref} />
          {canEdit && !editing && (
            <span ref={editWrapRef}>
              <Button
                variant="primary"
                icon="✎"
                disabled={moduleDown || blocked || session.phase === 'acquiring'}
                loading={session.phase === 'acquiring'}
                onClick={() => void startEditing()}
              >
                Editar
              </Button>
            </span>
          )}
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

      {renderNotice()}

      {editing ? (
        <DocumentEditor
          doc={doc}
          session={session}
          suppressNotices={moduleDown}
          onDone={() => setFocusEdit(true)}
        />
      ) : (
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
      )}
    </div>
  );
}
