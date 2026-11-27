'use client';

import React, { useId, useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { Loader } from '../Loader';
import styles from './Dropzone.module.scss';

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;
const INSTRUCTION = 'Arrastrá archivos aquí o hacé click para seleccionar';
const RESTRICTION = 'Máximo 10 MB por archivo. No se permiten ejecutables ni scripts.';

interface DropzoneProps {
  readonly accept?: string;
  readonly maxSize?: number;
  readonly multiple?: boolean;
  readonly onFiles: (files: FileList) => void;
  readonly error?: string;
  readonly uploading?: boolean;
}

function formatMaxSizeMb(maxSize: number): string {
  return `${Math.round(maxSize / (1024 * 1024))} MB`;
}

export function Dropzone({
  accept,
  maxSize = DEFAULT_MAX_SIZE,
  multiple = true,
  onFiles,
  error,
  uploading = false,
}: DropzoneProps) {
  const inputId = useId();
  const restrictionId = useId();
  const rejectionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | undefined>(undefined);

  const displayedError = error ?? rejectionReason;

  const validateAndEmit = (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      if (file.size > maxSize) {
        setRejectionReason(`El archivo supera ${formatMaxSizeMb(maxSize)}`);
        return;
      }
    }
    setRejectionReason(undefined);
    onFiles(fileList);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (files && files.length > 0) {
      validateAndEmit(files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      validateAndEmit(files);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div
        data-testid="dropzone-area"
        className={cn(styles.zone, {
          [styles.dragover]: isDragOver,
          [styles.error]: Boolean(displayedError),
        })}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <span className={styles.icon} aria-hidden="true">
          ⭱
        </span>
        {uploading ? (
          <span className={styles.uploading}>
            <Loader variant="inline" label="Subiendo archivo…" />
            Subiendo archivo…
          </span>
        ) : (
          <>
            <label htmlFor={inputId} className={styles.instruction}>
              {INSTRUCTION}
            </label>
            <p id={restrictionId} className={styles.restriction}>
              {RESTRICTION}
            </p>
          </>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className={styles.input}
          accept={accept}
          multiple={multiple}
          aria-describedby={restrictionId}
          onChange={handleChange}
        />
      </div>
      {displayedError && (
        <p id={rejectionId} className={styles.rejection} aria-live="assertive">
          {displayedError}
        </p>
      )}
    </div>
  );
}
