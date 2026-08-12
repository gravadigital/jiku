'use client';

import React, { useCallback, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { extractAttachmentIds } from '@/features/attachments/utils/extractAttachmentIds';
import { useAddRequirementActivity } from '../../hooks/useAddRequirementActivity';
import { RequirementRichTextEditor } from '../RequirementRichTextEditor';
import styles from './RequirementActivityForm.module.scss';
import type { VisibilityLevel } from '../../types/requirement.types';
import type { RequirementRichTextEditorHandle } from '../RequirementRichTextEditor';

interface RequirementActivityFormProps {
  readonly reqid: number;
}

export function RequirementActivityForm({ reqid }: RequirementActivityFormProps) {
  const { mutate: addActivity, isPending } = useAddRequirementActivity(reqid);
  const editorRef = useRef<RequirementRichTextEditorHandle>(null);
  const [visibility, setVisibility] = useState<VisibilityLevel>('internal');
  const [isEmpty, setIsEmpty] = useState(true);
  const [uploadError, setUploadError] = useState('');

  const handleEditorChange = useCallback((value: string) => {
    setIsEmpty(value.trim().length === 0);
  }, []);

  const handleAttachClick = useCallback(() => {
    editorRef.current?.openFilePicker();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const comment = editorRef.current?.getValue() ?? '';
      if (!comment.trim()) return;

      addActivity(
        {
          comment: comment.trim(),
          visibilityLevel: visibility,
          attachmentIds: extractAttachmentIds(comment),
        },
        {
          onSuccess: () => {
            toast.success('Comentario agregado');
            editorRef.current?.clear();
            setIsEmpty(true);
          },
          onError: (error: any) => {
            toast.error(error?.message ?? 'Error al agregar el comentario');
          },
        }
      );
    },
    [visibility, addActivity]
  );

  return (
    <form className={styles.activityForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.activityFormRow}>
        <RequirementRichTextEditor
          ref={editorRef}
          className={styles.commentEditor}
          placeholder="Escribe un comentario..."
          ariaLabel="Comentario"
          entityType="requirement_comment_draft"
          entityId={reqid}
          showToolbar={false}
          onChange={handleEditorChange}
          uploadError={uploadError}
          onUploadError={setUploadError}
        />
      </div>

      {uploadError && (
        <div className={styles.uploadError} role="alert">
          {uploadError}
        </div>
      )}

      <div className={styles.activityFormFooter}>
        <button
          type="button"
          className={styles.attachIconBtn}
          aria-label="Adjuntar archivo"
          disabled={isPending}
          onClick={handleAttachClick}
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
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          Adjuntar
        </button>

        <div className={styles.visToggle}>
          <button
            type="button"
            className={styles.visToggleBtn}
            data-active={visibility === 'internal'}
            onClick={() => setVisibility('internal')}
            aria-pressed={visibility === 'internal'}
            aria-label="Comentario interno"
          >
            Interno
          </button>
          <button
            type="button"
            className={styles.visToggleBtn}
            data-active={visibility === 'public'}
            onClick={() => setVisibility('public')}
            aria-pressed={visibility === 'public'}
            aria-label="Comentario público"
          >
            Público
          </button>
        </div>

        <button
          type="submit"
          className={styles.sendBtn}
          disabled={isEmpty || isPending}
          aria-label="Enviar comentario"
          data-testid="submit-button"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Enviar
        </button>
      </div>
    </form>
  );
}
