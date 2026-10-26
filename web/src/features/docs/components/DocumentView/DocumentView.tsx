'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { useCurrentUser } from '@/hooks/use-current-user';
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
import { metaVersionLabel, titleOf, visibilityLabel } from '../../utils/documentLabels';
import { editorLabel } from '../../utils/editorLabel';
import { isLockActive, lockedMessage } from '../../utils/lockState';
import { parseVersionParam, prunedDetailsOf } from '../../utils/versionErrors';
import { DocsNotice } from '../DocsNotice';
import { DocumentAttachments } from '../DocumentAttachments';
import { DocumentContent, useDocumentHeadings } from '../DocumentContent';
import { DocumentEditor } from '../DocumentEditor';
import { DocumentLinkedTo } from '../DocumentLinkedTo';
import { DocumentProperties } from '../DocumentProperties';
import { DocumentToc } from '../DocumentToc';
import { ShareDocumentDialog } from '../ShareDocumentDialog';
import { TopicPills } from '../TopicPills';
import { VersionHistoryPanel } from '../VersionHistoryPanel';
import { ClientProjectLine } from './ClientProjectLine';
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

const SHARE_NOTE = 'Los documentos restringidos no se pueden compartir por link.';
const HISTORY_LABEL = 'Historial de versiones';

// Sin documento (cargando no lo muestra) el breadcrumb queda como única salida.
const RouteNav = () => (
  <nav aria-label="Ruta" className={styles.route}>
    <ol className={styles.routeList}>
      <li>
        <Link href="/docs" className={styles.routeLink}>
          Documentación
        </Link>
      </li>
    </ol>
  </nav>
);

// Edición: `ViewHeader` solo admite un nivel de breadcrumb (DS gap), así que el de tres niveles
// se arma acá con el mismo armazón.
const EditingRouteNav = ({ title }: { readonly title: string }) => (
  <nav aria-label="Ruta" className={styles.route}>
    <ol className={styles.routeList}>
      <li>
        <Link href="/docs" className={styles.routeLink}>
          Documentación
        </Link>
      </li>
      <li className={styles.routeItem}>{title}</li>
      <li className={styles.routeItem} aria-current="page">
        Editando
      </li>
    </ol>
  </nav>
);

export function DocumentView({ id }: DocumentViewProps) {
  const searchParams = useSearchParams();
  const { status, isKnown, sharing } = useModule('docs');
  // Con un bloqueo vigente se revisa cada 60 s si venció (CA-S12); el flag es estado porque
  // se deriva del propio documento que esta consulta trae.
  const [polling, setPolling] = useState(false);
  const currentUser = useCurrentUser();
  const {
    data: doc,
    isError,
    error,
  } = useDocument({
    id,
    enabled: status !== 'not_installed',
    refetchInterval: polling ? LOCK_POLL_MS : false,
  });
  // La versión que se lee va en la URL. Siempre se pide además el vigente: de él salen la
  // cabecera, los permisos y la base de la restauración.
  const requested = parseVersionParam(searchParams.get('version'));
  const wantVersioned =
    requested !== null &&
    doc !== undefined &&
    requested !== doc.version &&
    status !== 'not_installed';
  const versioned = useDocument({
    id,
    version: requested ?? undefined,
    enabled: wantVersioned,
  });
  const versionedDoc = wantVersioned ? versioned.data : undefined;
  const versionedError = wantVersioned && versioned.isError ? versioned.error : null;
  const prunedDetails = prunedDetailsOf(versionedError);
  const shown = versionedDoc ?? doc;
  const headings = useDocumentHeadings(prunedDetails ? '' : (shown?.content ?? ''));
  const session = useEditSession({ documentId: id });
  const [now, setNow] = useState(() => new Date());
  const editWrapRef = useRef<HTMLSpanElement>(null);
  const [focusEdit, setFocusEdit] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const shareNoteId = useId();
  const editParamHandled = useRef(false);

  const lockedByOther = isLockActive(doc?.lock, now, session.sessionId);
  const blockedBy =
    session.blockedBy && new Date(session.blockedBy.expiresAt) > now ? session.blockedBy : null;
  const blocked = lockedByOther || Boolean(blockedBy);
  const editing = session.phase === 'editing' || session.phase === 'lost';
  // La interfaz es una ayuda: la autoridad es jiku-docs (`permission_denied`, `sharing_blocked`).
  const canEdit = Boolean(doc) && !doc?.contentUrl && !wantVersioned;
  // El botón se renderiza con la función de compartir configurada; se deshabilita en `restricted`.
  const canShare = sharing;
  const restricted = doc?.visibility === 'restricted';

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

  // P-10: tras crear un documento se entra directo en edición (`?editar=1`). La reserva se toma
  // primero y el parámetro se limpia después, con `history.replaceState` (sin navegación de Next,
  // que re-renderiza el segmento en pleno `lock`).
  const editParam = searchParams.get('editar') === '1';
  useEffect(() => {
    if (!editParam || !doc || editParamHandled.current) return;
    editParamHandled.current = true;
    const clean = () => window.history.replaceState(null, '', `/docs/${id}`);
    if (canEdit && !lockedByOther) void startEditing().finally(clean);
    else clean();
  }, [editParam, doc, canEdit, lockedByOther, id, startEditing]);

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
    let loading = false;
    if (moduleDown) {
      body = <DocsNotice intent="warning">{UNAVAILABLE_MESSAGE}</DocsNotice>;
    } else if (err && isNotFoundError) {
      body = <DocsNotice intent="error">{NOT_FOUND_MESSAGE}</DocsNotice>;
    } else if (err) {
      // Otro fallo: nunca se muestra como "no existe" ni como vacío.
      body = <DocsNotice intent="warning">{UNAVAILABLE_MESSAGE}</DocsNotice>;
    } else {
      body = <Loader variant="block" label="Cargando documento…" />;
      loading = true;
    }

    return (
      <div className={styles.page}>
        {!loading && <RouteNav />}
        {body}
      </div>
    );
  }

  const isPruned = prunedDetails !== null;
  const versionedFailed = versionedError !== null && !isPruned;
  const versionedLoading = wantVersioned && !versionedDoc && !versionedError;
  const title = titleOf(doc);
  const shownDoc = shown ?? doc;

  // Un solo aviso a la vez. Prioridad (los de conflicto y reserva perdida viven en el editor):
  // no disponible > compactada > versión anterior > bloqueado > documento grande.
  const renderNotice = () => {
    if (moduleDown || versionedFailed) {
      return <DocsNotice intent="warning">{UNAVAILABLE_MESSAGE}</DocsNotice>;
    }
    if (editing) return null;
    if (prunedDetails) {
      const { requestedVersion, previousAvailable, nextAvailable } = prunedDetails;
      const nearest = [previousAvailable, nextAvailable].filter(
        (value): value is number => typeof value === 'number'
      );
      return (
        <DocsNotice intent="warning">
          {`La versión ${requestedVersion} ya no se conserva: se compactó al limpiar el historial.`}
          {nearest.length > 0 && (
            <>
              {' Versiones más cercanas: '}
              {nearest.map((version, index) => (
                <React.Fragment key={version}>
                  {index > 0 && ' · '}
                  <Link href={`/docs/${id}?version=${version}`} className={styles.noticeLinks}>
                    {`Versión ${version}`}
                  </Link>
                </React.Fragment>
              ))}
            </>
          )}
        </DocsNotice>
      );
    }
    if (versionedDoc) {
      const who = editorLabel({
        name: versionedDoc.updatedByName,
        sub: versionedDoc.updatedBy,
        currentUserId: currentUser?.id,
      });
      return (
        <DocsNotice intent="info" role="status">
          {`Estás viendo la versión ${versionedDoc.version}, guardada el ${formatDateTime(versionedDoc.updatedAt)}${who === '—' ? '' : ` por ${who}`}. `}
          <Link href={`/docs/${id}`} className={styles.noticeLinks}>
            Ver la versión actual
          </Link>
        </DocsNotice>
      );
    }
    if (blockedBy) {
      return <DocsNotice intent="info">{lockedMessage(blockedBy, currentUser?.id)}</DocsNotice>;
    }
    if (lockedByOther && doc.lock) {
      return (
        <DocsNotice intent="info" role="none">
          {lockedMessage(doc.lock, currentUser?.id)}
        </DocsNotice>
      );
    }
    if (doc.contentUrl) return <DocsNotice intent="info">{LARGE_MESSAGE}</DocsNotice>;
    return null;
  };

  return (
    <div className={styles.page}>
      {editing && <EditingRouteNav title={title} />}
      <div className={styles.header}>
        {/* Va primero en el DOM que los botones: el orden de foco de la UX es breadcrumb → línea
            y temas → historial → compartir → editar. La grilla los posiciona. */}
        <div className={styles.heading}>
          <ViewHeader
            variant="detail"
            title={title}
            parent={editing ? undefined : { label: 'Documentación', href: '/docs' }}
            badges={[
              { variant: 'outline', family: 'neutral', label: visibilityLabel(doc.visibility) },
            ]}
          />
          <div className={styles.identity}>
            <ClientProjectLine
              clientRefs={doc.clientRefs ?? []}
              projectRefs={doc.projectRefs ?? []}
            />
            {!editing && (
              <TopicPills
                topics={doc.topics}
                max={Infinity}
                hrefOf={(topic) => `/docs?tema=${encodeURIComponent(topic)}`}
              />
            )}
          </div>
          <p className={styles.meta}>{metaVersionLabel(shownDoc, currentUser?.id)}</p>
        </div>
        <div className={styles.actionsColumn}>
          <div className={styles.actions}>
            {!editing && (
              <span className={styles.iconButton}>
                <Button
                  variant="secondary-nav"
                  icon="🕘"
                  disabled={moduleDown}
                  onClick={() => setHistoryOpen(true)}
                >
                  <span className={styles.srOnly}>{HISTORY_LABEL}</span>
                </Button>
              </span>
            )}
            {canShare && !editing && (
              <Button
                variant="secondary-nav"
                icon="↗"
                disabled={moduleDown || restricted}
                ariaDescribedBy={restricted ? shareNoteId : undefined}
                onClick={() => setShareOpen(true)}
              >
                Compartir
              </Button>
            )}
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
          {canShare && !editing && restricted && (
            <p id={shareNoteId} className={styles.shareNote}>
              {SHARE_NOTE}
            </p>
          )}
        </div>
      </div>

      {renderNotice()}

      {canShare && (
        <ShareDocumentDialog open={shareOpen} doc={doc} onClose={() => setShareOpen(false)} />
      )}
      {!editing && (
        <VersionHistoryPanel
          open={historyOpen}
          doc={doc}
          viewingVersion={wantVersioned ? requested : null}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {editing ? (
        <DocumentEditor
          doc={doc}
          session={session}
          suppressNotices={moduleDown}
          onDone={() => setFocusEdit(true)}
        />
      ) : (
        <div className={styles.reading}>
          {!isPruned && (
            <div className={styles.main}>
              {versionedLoading ? (
                <Loader variant="block" label="Cargando documento…" />
              ) : (
                <Card variant="panel">
                  <DocumentContent content={shownDoc.content ?? ''} />
                </Card>
              )}
            </div>
          )}
          <aside className={styles.side}>
            {!isPruned && <DocumentToc headings={headings} />}
            <DocumentLinkedTo
              clientRefs={doc.clientRefs ?? []}
              projectRefs={doc.projectRefs ?? []}
              requirementRefs={doc.requirementRefs ?? []}
              taskRefs={doc.taskRefs ?? []}
            />
            <DocumentProperties visibility={doc.visibility} version={shownDoc.version} />
            <DocumentAttachments attachments={doc.attachments ?? []} />
          </aside>
        </div>
      )}
    </div>
  );
}
