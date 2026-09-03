'use client';

import React, { useCallback, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { extractFileIds } from '@/features/attachments/utils/extractFileIds';
import { fileErrorMessage } from '@/features/attachments/utils/fileErrorMessages';
import { Button, ToggleGroup } from '@/shared/components/ui';
import { useAddRequirementActivity } from '../../hooks/useAddRequirementActivity';
import { RequirementRichTextEditor } from '../RequirementRichTextEditor';
import styles from './RequirementActivityForm.module.scss';
import type { VisibilityLevel } from '../../types/requirement.types';
import type { RequirementRichTextEditorHandle } from '../RequirementRichTextEditor';

const VISIBILITY_OPTIONS = [
  { value: 'internal', label: 'Interno' },
  { value: 'public', label: 'Público' },
];

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
    (e?: React.FormEvent) => {
      e?.preventDefault();
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
        <Button
          variant="secondary-dismiss"
          disabled={isPending || isUploading}
          onClick={handleAttachClick}
        >
          Adjuntar
        </Button>

        <ToggleGroup
          variant="segmented"
          label="Visibilidad del comentario"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(value) => setVisibility(value as VisibilityLevel)}
        />

        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={isEmpty || isPending || isUploading}
          loading={isPending}
          ariaDescribedBy={isUploading ? 'activity-upload-in-progress' : undefined}
        >
          Enviar
        </Button>
        {isUploading && (
          <span id="activity-upload-in-progress" className={styles.srOnly}>
            Hay una subida en curso: esperá a que el archivo termine de subir para enviar
          </span>
        )}
      </div>
    </form>
  );
}
