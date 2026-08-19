'use client';

import React, { useCallback, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { extractFileIds } from '@/features/attachments/utils/extractFileIds';
import { fileErrorMessage } from '@/features/attachments/utils/fileErrorMessages';
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
  const [upload, setUpload] = useState<{ fileName: string; progress: number } | null>(null);
  const isUploading = upload !== null;

  const handleEditorChange = useCallback((value: string) => {
    setIsEmpty(value.trim().length === 0);
  }, []);

  const handleAttachClick = useCallback(() => {
    editorRef.current?.openFilePicker();
  }, []);

  const handleUploadProgress = useCallback((progress: number, fileName: string) => {
    setUpload({ fileName, progress });
  }, []);

  const handleUploadingChange = useCallback((uploading: boolean) => {
    // La espera de la subida es distinta de la del envío: tiene porcentaje.
    // Fundirlas en un solo spinner tiraría la única información que el
    // rediseño aporta a esta pantalla.
    setUpload((current) => (uploading ? (current ?? { fileName: '', progress: 0 }) : null));
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
          fileIds: extractFileIds(comment),
        },
        {
          onSuccess: () => {
            toast.success('Comentario agregado');
            editorRef.current?.clear();
            setIsEmpty(true);
          },
          onError: (error: unknown) => {
            toast.error(fileErrorMessage(error, 'Hubo un error al agregar el comentario'));
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
          showToolbar={false}
          onChange={handleEditorChange}
          uploadError={uploadError}
          onUploadError={setUploadError}
          onUploadProgress={handleUploadProgress}
          onUploadingChange={handleUploadingChange}
        />
      </div>

      {uploadError && (
        <div className={styles.uploadError} role="alert">
          {uploadError}
        </div>
      )}

      {upload && (
        <div className={styles.uploadProgress}>
          <p className={styles.uploadProgressText}>
            Subiendo {upload.fileName}... {upload.progress}%
          </p>
          <div
            className={styles.uploadProgressBar}
            role="progressbar"
            aria-valuenow={upload.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={styles.uploadProgressFill}
              style={{ width: `${upload.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className={styles.activityFormFooter}>
        <button
          type="button"
          className={styles.attachIconBtn}
          aria-label="Adjuntar archivo"
          disabled={isPending || isUploading}
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
          disabled={isEmpty || isPending || isUploading}
          aria-label="Enviar comentario"
          aria-describedby={isUploading ? 'activity-upload-in-progress' : undefined}
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
        {isUploading && (
          <span id="activity-upload-in-progress" className={styles.srOnly}>
            Hay una subida en curso: esperá a que el archivo termine de subir para enviar
          </span>
        )}
      </div>
    </form>
  );
}
