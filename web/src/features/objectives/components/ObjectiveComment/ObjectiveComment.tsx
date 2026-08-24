'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { updateComment } from '@/features/objectives/services/commentsApi';
import { Button, Tooltip } from '@/shared/components/ui';
import { AutomatedIdentityBadge } from '@/shared/components/ui/AutomatedIdentityBadge';
import { calculateTimeSince, formatDate } from '@/shared/utils';
import editIcon from '@root/assets/edit.svg';
import { useCurrentUser } from '@root/hooks/use-current-user';
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
  readonly updateDate: Date;
  readonly content: string;
  readonly objectiveId: number;
  readonly commentId: number;
  readonly previousValue: string;
  readonly visibilityLevel?: ActivityVisibilityLevel;
}

export function ObjectiveComment({
  authorName,
  authorId,
  authorIdentityType,
  date,
  updateDate,
  content,
  objectiveId,
  commentId,
  previousValue,
  visibilityLevel = 'internal',
}: CommentProps) {
  const user = useCurrentUser();
  const { push } = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setLoading(true);
    if (!editedContent.trim()) {
      toast.error('El comentario no puede estar vacío');
      setLoading(false);
      return;
    }

    updateComment(objectiveId, commentId, { comment: editedContent })
      .then(() => {
        setIsEditing(false);
        setLoading(false);
        toast.success('Comentario editado exitosamente');
        return push(`/objectives/${objectiveId}`);
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
        return toast.error('Hubo un error al editar el comentario');
      });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(content);
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
          {previousValue ? (
            <Tooltip
              message={`Editado hace
              ${calculateTimeSince(new Date(updateDate))}`}
            >
              <span className={styles.editedLabel}>(editado)</span>
            </Tooltip>
          ) : null}
          <div>
            <Tooltip message={`Creación: ${formatDate(new Date(date))}`}>
              <span className={styles.commentDate}>
                {' Hace '}
                {calculateTimeSince(new Date(date))}
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className={styles.markdownContainer}>
        {isEditing ? (
          <textarea
            value={editedContent}
            onChange={(event) => setEditedContent(event.target.value)}
            className={styles.editTextarea}
          />
        ) : (
          <div className={styles.markdownContent}>
            <MarkdownViewer content={content} />
          </div>
        )}
        {user && user.id === authorId ? (
          <div className={styles.editButtonContainer}>
            {isEditing ? (
              <>
                <div className={styles.cancelButton}>
                  <Button key="action-cancel" onClick={handleCancel} label="Cancelar" />
                </div>
                <div className={styles.saveButton}>
                  <Button
                    key="action-save"
                    onClick={handleSave}
                    label="Guardar"
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
