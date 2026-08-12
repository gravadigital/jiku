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

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv';

export function FileUploader({ entityType, entityId, onUploadSuccess }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    mutate: uploadFiles,
    isPending,
    progress,
  } = useUploadAttachment({
    onSuccess: () => {
      setError(null);
      onUploadSuccess?.();
    },
    onError: (err: Error) => {
      const entityLabels = {
        objective: 'esta tarea',
        project: 'este proyecto',
        stage: 'esta etapa',
        requirement_draft: 'este requisito',
        comment_draft: 'este comentario',
        objective_comment: 'este comentario',
        requirement_comment: 'este comentario',
        objective_comment_draft: 'este comentario',
        requirement_comment_draft: 'este comentario',
      } satisfies Record<EntityType, string>;
      const msg = err.message.toLowerCase().includes('permission')
        ? `No tenés permisos para subir archivos a ${entityLabels[entityType]}`
        : err.message;
      setError(msg);
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
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error ?? 'Archivo inválido');
        return;
      }
    }
    setError(null);
    uploadFiles({ entityType, entityId, files });
  };

  const handleClick = () => {
    if (!isPending) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={styles.container}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Área de carga de archivos. Arrastrá archivos aquí o hacé click para seleccionar"
        className={cn(styles.dropzone, {
          [styles.dragging]: isDragging,
          [styles.uploading]: isPending,
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
          disabled={isPending}
          aria-hidden="true"
          tabIndex={-1}
        />

        {isPending ? (
          <div className={styles.progressContainer}>
            <p className={styles.uploadingText}>Subiendo archivos...</p>
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
            <p className={styles.mainText}>Arrastrá archivos aquí o hacé click para seleccionar</p>
            <p className={styles.subText}>
              Máximo 10MB por archivo. Formatos: imágenes, PDF, documentos Office
            </p>
          </>
        )}
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
