'use client';

import React, { useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { useAttachments } from '@/features/attachments/hooks/useAttachments';
import { extractFileIds } from '@/features/attachments/utils/extractFileIds';
import { commentErrorMessage } from '@/features/attachments/utils/fileErrorMessages';
import { Button, Tooltip } from '@/shared/components/ui';
import { AutomatedIdentityBadge } from '@/shared/components/ui/AutomatedIdentityBadge';
import { calculateTimeSince, formatDate } from '@/shared/utils';
import { useUpdateRequirementComment } from '../../hooks/useUpdateRequirementComment';
import { getActivityFieldLabel, getActivityValueLabel } from '../../utils/requirementHelpers';
import { RequirementRichTextEditor } from '../RequirementRichTextEditor';
import styles from './RequirementActivityFeed.module.scss';
import type { RequirementActivity, RequirementState } from '../../types/requirement.types';
import type { RequirementRichTextEditorHandle } from '../RequirementRichTextEditor';

interface RequirementActivityFeedProps {
  readonly activity: RequirementActivity[];
  /** Requisito dueño del feed. Necesario para el hook de edición de comentarios (S-048). */
  readonly reqid: number;
}

const STATE_LABELS: Record<RequirementState, string> = {
  analisis: 'Análisis',
  planificacion: 'Planificación',
  en_cola: 'En cola',
  desarrollo: 'Desarrollo',
  revision: 'Revisión',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

function formatStateLabel(value: string | null): string {
  if (!value) return '—';
  return STATE_LABELS[value as RequirementState] ?? value;
}

function getActorName(entry: RequirementActivity): string {
  return entry.changedByUser?.name ?? entry.changedBy;
}

/**
 * Resuelve el nombre de quien hizo la ultima edicion de un comentario, buscandolo entre los
 * `changedByUser` de las entradas que el feed ya trae. La api no manda un `editedByUser`
 * propio (S-047), asi que no hay otro dato del que salir: si el id de `editedBy` no aparece
 * como autor de ninguna entrada del mismo feed, se degrada a "(editado)" sin nombre en vez
 * de mostrar el id crudo (CA-5, AC-2).
 */
function resolveEditorName(
  editedBy: string,
  allActivity: RequirementActivity[]
): string | null {
  const match = allActivity.find((entry) => entry.changedByUser?.id === editedBy);
  return match?.changedByUser?.name ?? null;
}

/**
 * Texto de la marca "(editado)" / "(editado por X)". Depende exclusivamente de `editedAt`:
 * una entrada con `previousValue` no vacio pero sin `editedAt` (edicion hecha por la ruta
 * vieja, previa a S-047) NO la muestra (CA-6, CA-7) — es texto, no solo estilo, para que un
 * lector de pantalla la anuncie junto al resto de la entrada (AC-4 de la pantalla).
 *
 * Sin Tooltip propio: la fecha de edicion se anuncia en el tooltip combinado de `.time`
 * (junto a la de creacion), no en uno separado — así lo pide el screen.md ("el tooltip de la
 * fecha vive en el mismo tooltip que la de creación").
 */
function editedMarkLabel(entry: RequirementActivity, allActivity: RequirementActivity[]): string | null {
  if (!entry.editedAt) return null;

  const editedByOther = entry.editedBy !== null && entry.editedBy !== entry.changedBy;
  const editorName = editedByOther ? resolveEditorName(entry.editedBy as string, allActivity) : null;
  return editedByOther && editorName ? `(editado por ${editorName})` : '(editado)';
}

/**
 * Mensaje del tooltip combinado de fecha: siempre la fecha de creacion, y ademas la de la
 * ultima edicion cuando el comentario tiene `editedAt` (AC-8 de detalle-requisito / AC-9 de
 * detalle-tarea: "el tooltip de la fecha puede mostrar cuándo fue la última edición junto a
 * la de creación").
 */
function dateTooltipMessage(createdAt: string, editedAt: string | null): string {
  const base = `Creación: ${formatDate(new Date(createdAt))}`;
  if (!editedAt) return base;
  return `${base} · Editado: ${formatDate(new Date(editedAt))}`;
}

/**
 * El autor de una entrada del feed: su nombre y, cuando NO es una persona, la marca de
 * identidad automatica. Es el UNICO lugar de la pantalla donde se decide eso, y por eso
 * las cuatro formas de entrada (state, comment, resolution y generica) lo comparten.
 */
function ActorName({ entry }: { readonly entry: RequirementActivity }) {
  return (
    <>
      <strong>{getActorName(entry)}</strong>{' '}
      <AutomatedIdentityBadge identityType={entry.changedByUser?.identityType} />
    </>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = ['#43a047', '#1e88e5', '#e53935', '#8e24aa', '#f4511e', '#00897b'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatStateChange(entry: RequirementActivity): React.ReactNode {
  return (
    <>
      <ActorName entry={entry} />
      {' cambió el estado de '}
      <strong>{formatStateLabel(entry.previousValue)}</strong>
      {' a '}
      <strong className={styles.newValue}>{formatStateLabel(entry.newValue)}</strong>
    </>
  );
}

function formatComment(entry: RequirementActivity): React.ReactNode {
  return (
    <>
      <ActorName entry={entry} />
      {' comentó'}
    </>
  );
}

function formatResolution(entry: RequirementActivity): React.ReactNode {
  return (
    <>
      <ActorName entry={entry} />
      {' agregó una resolución'}
    </>
  );
}

function formatGeneric(entry: RequirementActivity): React.ReactNode {
  const fieldLabel = getActivityFieldLabel(entry.typeOfActivity);
  const showValues =
    entry.typeOfActivity !== 'description' &&
    Boolean(entry.previousValue) &&
    Boolean(entry.newValue);

  return (
    <>
      <ActorName entry={entry} />
      {' cambió '}
      {fieldLabel}
      {showValues && (
        <>
          {' de '}
          <strong>
            {getActivityValueLabel(entry.typeOfActivity, entry.previousValue as string)}
          </strong>
          {' a '}
          <strong className={styles.newValue}>
            {getActivityValueLabel(entry.typeOfActivity, entry.newValue)}
          </strong>
        </>
      )}
    </>
  );
}

/**
 * Formulario inline de edicion de un comentario (Tarea 4). Reutiliza el mismo editor del
 * alta, sin toggle de visibilidad (CA-8): el campo es inmutable despues de creado. Los
 * adjuntos se editan en la Tarea 5; por ahora guarda con el `fileIds` extraido del propio
 * comentario original, para no perder los que ya tenia.
 */
function CommentEditForm({
  entry,
  reqid,
  onDone,
  onCancel,
}: {
  readonly entry: RequirementActivity;
  readonly reqid: number;
  readonly onDone: () => void;
  readonly onCancel: () => void;
}) {
  const editorRef = useRef<RequirementRichTextEditorHandle>(null);
  const [isEmpty, setIsEmpty] = useState(entry.newValue.trim().length === 0);
  const [removedLinkIds, setRemovedLinkIds] = useState<Set<number>>(new Set());
  const { mutate, isPending } = useUpdateRequirementComment(reqid);
  // El texto ya guardado referencia sus adjuntos como [attach:N] (id de VINCULO), nunca
  // como [file:N]: por eso la fuente de la lista visible y del fileId de cada adjunto
  // existente es useAttachments, no un parseo del texto (Tarea 5, nota tecnica central).
  const { data: existingAttachments = [] } = useAttachments('requirement_comment', entry.id);

  const visibleAttachments = existingAttachments.filter((a) => !removedLinkIds.has(a.id));

  React.useEffect(() => {
    editorRef.current?.focus();
  }, []);

  const handleSave = () => {
    const comment = editorRef.current?.getValue() ?? '';
    if (!comment.trim()) return;

    const keptFileIds = visibleAttachments.map((a) => a.fileId);
    // extractFileIds solo encuentra placeholders [file:N]: los adjuntos preexistentes
    // (leidos arriba de useAttachments) usan [attach:N] y nunca aparecen aca, asi que no
    // hay doble conteo entre las dos fuentes.
    const uploadedFileIds = extractFileIds(comment);
    const fileIdSet = new Set([...keptFileIds, ...uploadedFileIds]);
    const hadOrHasAttachments = existingAttachments.length > 0 || uploadedFileIds.length > 0;

    mutate(
      {
        cid: entry.id,
        comment: comment.trim(),
        // AC-6: se manda la clave (incluso vacia) apenas hubo o hay algun adjunto en juego;
        // se omite solo cuando el comentario nunca tuvo adjuntos y no se subio ninguno.
        ...(hadOrHasAttachments ? { fileIds: Array.from(fileIdSet) } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Comentario editado');
          onDone();
        },
        onError: (error: unknown) => {
          toast.error(commentErrorMessage(error, 'Hubo un error al editar el comentario'));
          // Los tres codigos de error que esta pantalla puede ver (autoria, tipo de entrada,
          // comentario borrado) son casos que no deberian alcanzarse desde una UI actualizada
          // (red de seguridad, no flujo previsto): se vuelve a lectura con el contenido
          // original, que es el que sigue guardado porque la escritura no se aplico (CA-10).
          onCancel();
        },
      }
    );
  };

  return (
    <>
      <RequirementRichTextEditor
        ref={editorRef}
        initialValue={entry.newValue}
        ariaLabel="Editar comentario"
        onChange={(value) => setIsEmpty(value.trim().length === 0)}
        disabled={isPending}
      />
      {visibleAttachments.length > 0 && (
        <ul className={styles.attachmentList}>
          {visibleAttachments.map((attachment) => (
            <li key={attachment.id} className={styles.attachmentItem}>
              <span>{attachment.fileName}</span>
              <button
                type="button"
                className={styles.removeAttachmentButton}
                aria-label={`Quitar ${attachment.fileName}`}
                onClick={() =>
                  setRemovedLinkIds((prev) => new Set(prev).add(attachment.id))
                }
                disabled={isPending}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.editFormActions}>
        {/* size="small" para igualar el boton "Enviar" del compositor de comentarios
            (RequirementActivityForm .sendBtn: 34px de alto, 0.875rem), que es el que
            queda inmediatamente debajo en la pantalla. */}
        <Button
          label="Cancelar"
          variant="secondary"
          size="small"
          onClick={() => {
            setRemovedLinkIds(new Set());
            onCancel();
          }}
          disabled={isPending}
        />
        <Button
          label="Guardar"
          variant="primary"
          size="small"
          onClick={handleSave}
          disabled={isEmpty || isPending}
          loading={isPending}
        />
      </div>
    </>
  );
}

export function RequirementActivityFeed({ activity, reqid }: RequirementActivityFeedProps) {
  const { data: session } = useSession();
  // Criterio de comparacion elegido para AC-5/CA-4: session.user.id, no session.user.zitadelId.
  // `changedBy` viaja desde `core` como el mismo userId que `ObjectiveComment` ya compara con
  // `useCurrentUser().id` (que a su vez lee `session.user.id`) para su propio gate de autoria.
  // Usar `zitadelId` aca introduciria un segundo criterio para el mismo dato sin necesidad.
  const currentUserId = session?.user?.id;
  const isAdmin = Boolean(session?.user?.roles?.includes('admin'));
  // Un solo id en edicion implementa "se edita de a uno por vez" (AC-7) sin lógica extra:
  // abrir otro reemplaza el valor y la entrada anterior vuelve a lectura sola.
  const [editingId, setEditingId] = useState<number | null>(null);
  const editButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const handleCancelEdit = (entryId: number) => {
    setEditingId(null);
    // Devuelve el foco al boton que abrio la edicion (accesibilidad de detalle-requisito).
    requestAnimationFrame(() => editButtonRefs.current.get(entryId)?.focus());
  };

  if (activity.length === 0) {
    return <div className={styles.empty}>Sin actividad registrada</div>;
  }

  const sortedActivity = [...activity].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className={styles.feed}>
      {sortedActivity.map((entry) => {
        const isComment = entry.typeOfActivity === 'comment';
        const isState = entry.typeOfActivity === 'state';
        const isResolution = entry.typeOfActivity === 'resolution';
        const showText = isComment || isResolution;
        const timeAgo = `hace ${calculateTimeSince(new Date(entry.createdAt))}`;
        const canEdit =
          isComment && Boolean(currentUserId) && (entry.changedBy === currentUserId || isAdmin);
        const isEditingThis = editingId === entry.id;
        const editedLabel = editedMarkLabel(entry, sortedActivity);

        return (
          <div key={entry.id} className={styles.entry}>
            <div
              className={styles.avatar}
              style={{ background: getAvatarColor(getActorName(entry)) }}
            >
              {getInitials(getActorName(entry))}
            </div>
            <div className={styles.body}>
              <div className={styles.entryRow}>
                <div className={styles.text}>
                  {isState
                    ? formatStateChange(entry)
                    : isComment
                      ? formatComment(entry)
                      : isResolution
                        ? formatResolution(entry)
                        : formatGeneric(entry)}
                </div>
                {isComment && (
                  <span className={styles.visibility}>
                    {entry.visibilityLevel === 'internal' ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    )}
                    {entry.visibilityLevel === 'internal' ? 'Interno' : 'Público'}
                  </span>
                )}
              </div>
              {isEditingThis ? (
                <div className={styles.editForm}>
                  <CommentEditForm
                    entry={entry}
                    reqid={reqid}
                    onDone={() => setEditingId(null)}
                    onCancel={() => handleCancelEdit(entry.id)}
                  />
                </div>
              ) : (
                showText && (
                  <div className={styles.comment}>
                    <MarkdownViewer content={entry.newValue} />
                  </div>
                )
              )}
              <div className={styles.footerRow}>
                <Tooltip message={dateTooltipMessage(entry.createdAt, entry.editedAt)}>
                  <div className={`${styles.time}${showText ? ` ${styles.timeAfterComment}` : ''}`}>
                    {timeAgo}
                    {editedLabel && <span className={styles.editedLabel}> {editedLabel}</span>}
                  </div>
                </Tooltip>
                {canEdit && !isEditingThis && (
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) editButtonRefs.current.set(entry.id, el);
                      else editButtonRefs.current.delete(entry.id);
                    }}
                    className={styles.editButton}
                    aria-label="Editar comentario"
                    onClick={() => setEditingId(entry.id)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
