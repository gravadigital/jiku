'use client';
import React, { useState, useRef } from 'react';
import { cn } from '@/shared/utils';
import { useUploadAttachment } from '../../hooks/useUploadAttachment';
import { validateFile } from '../../utils/fileValidation';
import styles from './FileUploader.module.scss';
import type { EntityType } from '../../types/attachment.types';
import type { DragEvent } from 'react';

interface FileUploaderProps {
  readonly entityType: EntityType;
  readonly entityId: number;
  readonly onUploadSuccess?: () => void;
}

// Cosmético: sugiere tipos en el selector del sistema operativo. NO es
// validación — la autoritativa vive en `core` y se aplica al pedir el ticket.
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv';

const ENTITY_LABELS = {
  project: 'este proyecto',
  requirement: 'este requisito',
  objective: 'esta tarea',
  requirement_comment: 'este comentario',
  objective_comment: 'este comentario',
} satisfies Record<EntityType, string>;

export function FileUploader({ entityType, entityId, onUploadSuccess }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFiles, retryFailed, currentFileName, progress, isUploading, errors, retryableFiles } =
    useUploadAttachment({
      entityType,
      entityId,
      onSettled: () => {
        onUploadSuccess?.();
      },
    });

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    // El rechazo lo decide el servidor por archivo: un archivo inválido en la
    // tanda no cancela a los demás (CA-2).
    const rejected: string[] = [];
    const accepted = files.filter((file) => {
      const validation = validateFile(file);
      if (validation.valid) {
        return true;
      }
      rejected.push(validation.error ?? `El archivo "${file.name}" no se puede subir`);
      return false;
    });

    setValidationError(rejected.length > 0 ? rejected.join(' ') : null);

    if (accepted.length > 0) {
      void uploadFiles(accepted);
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const permissionAwareMessage = (message: string) =>
    message.toLowerCase().includes('permission')
      ? `No tenés permisos para subir archivos a ${ENTITY_LABELS[entityType]}`
      : message;

  return (
    <div className={styles.container}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Área de carga de archivos. Arrastrá un archivo aquí o hacé click para seleccionarlo"
        className={cn(styles.dropzone, {
          [styles.dragging]: isDragging,
          [styles.uploading]: isUploading,
        })}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileInputChange}
          className={styles.hiddenInput}
          disabled={isUploading}
          aria-hidden="true"
          tabIndex={-1}
        />

        {isUploading ? (
          <div className={styles.progressContainer}>
            <p className={styles.uploadingText}>Subiendo {currentFileName}...</p>
            <div
              className={styles.progressBar}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <p className={styles.progressText}>{progress}%</p>
          </div>
        ) : (
          <>
            <svg
              className={styles.uploadIcon}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
            </svg>
            <p className={styles.mainText}>
              Arrastrá un archivo acá o hacé click para seleccionarlo
            </p>
          </>
        )}
      </div>

      {validationError && (
        <div className={styles.error} role="alert">
          {validationError}
        </div>
      )}

      {errors.length > 0 && (
        <div className={styles.error} role="alert">
          {errors.map((error) => (
            <p key={error.fileName} className={styles.errorLine}>
              {permissionAwareMessage(error.message)}
            </p>
          ))}
          {retryableFiles.length > 0 && !isUploading && (
            <button type="button" className={styles.retryButton} onClick={retryFailed}>
              Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
