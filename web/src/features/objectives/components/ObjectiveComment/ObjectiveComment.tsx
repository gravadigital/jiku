'use client';
import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { useAttachments } from '@/features/attachments/hooks/useAttachments';
import { extractFileIds } from '@/features/attachments/utils/extractFileIds';
import { commentErrorMessage } from '@/features/attachments/utils/fileErrorMessages';
import { updateComment } from '@/features/objectives/services/commentsApi';
import {
  RequirementRichTextEditor,
  type RequirementRichTextEditorHandle,
} from '@/features/requirements/components/RequirementRichTextEditor';
import { Button, Tooltip } from '@/shared/components/ui';
import { AutomatedIdentityBadge } from '@/shared/components/ui/AutomatedIdentityBadge';
import { calculateTimeSince, formatDate } from '@/shared/utils';
import editIcon from '@root/assets/edit.svg';
import styles from './ObjectiveComment.module.scss';
import type { ActivityVisibilityLevel } from '@/features/objectives/types';
import type { IdentityType } from '@/shared/types';

interface CommentProps {
  readonly authorName: string;
  readonly authorId: string;
  /**
   * Tipo de identidad del autor. Opcional a proposito: un llamador que no lo pase deja el
   * comentario sin marca, que es el comportamiento previo a S-019.
   */
  readonly authorIdentityType?: IdentityType;
  readonly date: Date;
  readonly content: string;
  readonly objectiveId: number;
  readonly commentId: number;
  readonly visibilityLevel?: ActivityVisibilityLevel;
  /**
   * ISO string de la ultima edicion del comentario. `null` si nunca fue editado (S-048).
   * Reemplaza al heuristico previo basado en `previousValue` (CA-6).
   */
  readonly editedAt: string | null;
  /** Id de quien hizo la ultima edicion. `null` si nunca fue editado (S-048). */
  readonly editedBy: string | null;
  /**
   * Nombre resuelto de `editedBy`, ya buscado por `ObjectiveHistoryList` entre los autores
   * que la propia lista de actividad trae. `null` si no se pudo resolver (degrada a
   * "(editado)" sin nombre, nunca muestra el id crudo).
   */
  readonly editedByName: string | null;
}

/**
 * Texto de la marca "(editado)" / "(editado por X)". Depende exclusivamente de `editedAt`:
 * un comentario con `previousValue` no vacio pero sin `editedAt` (edicion hecha antes de
 * S-047/S-048) NO la muestra (CA-6, CA-7) — mismo criterio que `RequirementActivityFeed`.
 *
 * Sin Tooltip propio: la fecha de edicion se anuncia en el tooltip combinado de la fecha
 * (junto a la de creacion) — así lo pide el screen.md de detalle-tarea (AC-9).
 */
function editedMarkLabel(
  editedAt: string | null,
  editedBy: string | null,
  authorId: string,
  editedByName: string | null
): string | null {
  if (!editedAt) return null;

  const editedByOther = editedBy !== null && editedBy !== authorId;
  return editedByOther && editedByName ? `(editado por ${editedByName})` : '(editado)';
}

/**
 * Mensaje del tooltip combinado de fecha: siempre la fecha de creacion, y ademas la de la
 * ultima edicion cuando el comentario tiene `editedAt` (AC-9: "el tooltip de la fecha puede
 * mostrar la fecha de última edición junto a la de creación").
 */
function dateTooltipMessage(date: Date, editedAt: string | null): string {
  const base = `Creación: ${formatDate(date)}`;
  if (!editedAt) return base;
  return `${base} · Editado: ${formatDate(new Date(editedAt))}`;
}

export function ObjectiveComment({
  authorName,
  authorId,
  authorIdentityType,
  date,
  content,
  objectiveId,
  commentId,
  visibilityLevel = 'internal',
  editedAt,
  editedBy,
  editedByName,
}: CommentProps) {
  const { data: session } = useSession();
  // Mismo criterio que RequirementActivityFeed (S-048): session.user.id, no zitadelId. Es el
  // mismo userId que `changedBy`/`user.id` ya trae desde `core`.
  const currentUserId = session?.user?.id;
  const isAdmin = Boolean(session?.user?.roles?.includes('admin'));
  const canEdit = Boolean(currentUserId) && (currentUserId === authorId || isAdmin);
  const editedLabel = editedMarkLabel(editedAt, editedBy, authorId, editedByName);

  const { push } = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [removedLinkIds, setRemovedLinkIds] = useState<Set<number>>(new Set());
  const editorRef = useRef<RequirementRichTextEditorHandle>(null);
  const [isEmpty, setIsEmpty] = useState(content.trim().length === 0);
  const [loading, setLoading] = useState(false);
  // El texto ya guardado referencia sus adjuntos como [attach:N] (id de VINCULO), nunca
  // como [file:N]: por eso la fuente de la lista visible y del fileId de cada adjunto
  // existente es useAttachments, no un parseo del texto (mismo patron que el feed del
  // requisito, Tarea 5).
  const { data: existingAttachments = [] } = useAttachments('objective_comment', commentId);
  const visibleAttachments = existingAttachments.filter((a) => !removedLinkIds.has(a.id));

  const handleEdit = () => {
    setIsEditing(true);
    setIsEmpty(content.trim().length === 0);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setRemovedLinkIds(new Set());
  };

  const handleSave = () => {
    const comment = editorRef.current?.getValue() ?? '';
    if (!comment.trim()) return;

    setLoading(true);

    const keptFileIds = visibleAttachments.map((a) => a.fileId);
    // extractFileIds solo encuentra placeholders [file:N]: los adjuntos preexistentes
    // (leidos arriba de useAttachments) usan [attach:N] y nunca aparecen aca, asi que no
    // hay doble conteo entre las dos fuentes.
    const uploadedFileIds = extractFileIds(comment);
    const fileIdSet = new Set([...keptFileIds, ...uploadedFileIds]);
    const hadOrHasAttachments = existingAttachments.length > 0 || uploadedFileIds.length > 0;

    updateComment(objectiveId, commentId, {
      comment: comment.trim(),
      ...(hadOrHasAttachments ? { fileIds: Array.from(fileIdSet) } : {}),
    })
      .then(() => {
        setIsEditing(false);
        setLoading(false);
        setRemovedLinkIds(new Set());
        toast.success('Comentario editado exitosamente');
        // El refresco de esta pantalla es por router.push(), no por invalidacion de query:
        // objectives/[id]/page.tsx es un Server Component sin QueryClient para la actividad
        // (a diferencia del detalle de requisito). Mantenido tal cual porque montar la
        // query excede esta story (S-048, Tarea 6).
        return push(`/objectives/${objectiveId}`);
      })
      .catch((error: unknown) => {
        setLoading(false);
        toast.error(commentErrorMessage(error, 'Hubo un error al editar el comentario'));
        // Los codigos de error que esta pantalla puede ver (autoria, tipo de entrada,
        // comentario borrado, adjunto ajeno) son casos que no deberian alcanzarse desde una
        // UI actualizada (red de seguridad, no flujo previsto): se vuelve a lectura con el
        // contenido original, que es el que sigue guardado porque la escritura no se aplico
        // (CA-10, mismo patron que RequirementActivityFeed).
        setIsEditing(false);
        setRemovedLinkIds(new Set());
      });
  };

  return (
    <div className={styles.commentContainer}>
      <div className={styles.commentHeader}>
        <div className={styles.authorSection}>
          <span className={styles.authorName}>{authorName}</span>
          <AutomatedIdentityBadge identityType={authorIdentityType} />
          <Tooltip
            message={visibilityLevel === 'public' ? 'Visible para externos' : 'Solo interno'}
          >
            <span className={styles.visibilityBadge} data-level={visibilityLevel}>
              {visibilityLevel === 'public' ? '👁' : '🔒'}
            </span>
          </Tooltip>
        </div>
        <div className={styles.headerRight}>
          <Tooltip message={dateTooltipMessage(date, editedAt)}>
            <span className={styles.commentDate}>
              {' Hace '}
              {calculateTimeSince(new Date(date))}
              {editedLabel && <span className={styles.editedLabel}> {editedLabel}</span>}
            </span>
          </Tooltip>
        </div>
      </div>
      <div className={styles.markdownContainer}>
        {isEditing ? (
          <>
            <RequirementRichTextEditor
              ref={editorRef}
              initialValue={content}
              ariaLabel="Editar comentario"
              onChange={(value) => setIsEmpty(value.trim().length === 0)}
              disabled={loading}
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
                      disabled={loading}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className={styles.markdownContent}>
            <MarkdownViewer content={content} />
          </div>
        )}
        {canEdit ? (
          <div className={styles.editButtonContainer}>
            {isEditing ? (
              <>
                <div className={styles.cancelButton}>
                  <Button
                    key="action-cancel"
                    onClick={handleCancel}
                    label="Cancelar"
                    disabled={loading}
                  />
                </div>
                <div className={styles.saveButton}>
                  <Button
                    key="action-save"
                    onClick={handleSave}
                    label="Guardar"
                    disabled={isEmpty || loading}
                    loading={loading}
                  />
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={handleEdit}
                className={styles.editButton}
                aria-label="Editar comentario"
              >
                <Image src={editIcon} alt="Editar" width={15} height={15} />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
