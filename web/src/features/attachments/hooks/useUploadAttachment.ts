'use client';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { uploadFile } from '../services/attachmentsClientApi';
import type { EntityType } from '../types/attachment.types';

export interface UploadQueueError {
  readonly fileName: string;
  readonly message: string;
  /** El error se puede reintentar pidiendo un ticket nuevo (URL vencida, red). */
  readonly retryable: boolean;
}

export interface UploadQueueState {
  /** Nombre del archivo que está subiendo ahora. `null` si no hay ninguno. */
  readonly currentFileName: string | null;
  /** Progreso real del PUT del archivo en curso, 0-100. */
  readonly progress: number;
  readonly isUploading: boolean;
  readonly errors: readonly UploadQueueError[];
  /** Archivos que fallaron y se pueden volver a intentar. */
  readonly retryableFiles: readonly File[];
}

interface UseUploadAttachmentOptions {
  readonly entityType: EntityType;
  readonly entityId: number | null;
  readonly onFileUploaded?: (fileId: number, file: File) => void;
  readonly onSettled?: () => void;
  readonly onError?: (error: UploadQueueError) => void;
}

/**
 * Sube archivos de a uno por vez (RF-7). Cada archivo pide su propio ticket y
 * hace su propio PUT: el fallo de uno no cancela los otros, y la cola sigue.
 *
 * El estado describe la cola —archivo en curso, su porcentaje, errores
 * acumulados— y no un `progress` suelto: es lo que permite nombrar el archivo
 * que está subiendo sin que el componente lo adivine.
 */
export function useUploadAttachment({
  entityType,
  entityId,
  onFileUploaded,
  onSettled,
  onError,
}: UseUploadAttachmentOptions) {
  const queryClient = useQueryClient();
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<readonly UploadQueueError[]>([]);
  const [retryableFiles, setRetryableFiles] = useState<readonly File[]>([]);

  const uploadFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) {
        return;
      }

      setIsUploading(true);
      setErrors([]);
      setRetryableFiles([]);

      let uploadedAny = false;

      for (const file of files) {
        setCurrentFileName(file.name);
        setProgress(0);
        try {
          const fileId = await uploadFile(file, { onProgress: setProgress });
          uploadedAny = true;
          onFileUploaded?.(fileId, file);
        } catch (error) {
          // El fallo de un archivo no arrastra a los otros (CA-2): se registra
          // y la cola sigue con el siguiente.
          const queueError: UploadQueueError = {
            fileName: file.name,
            message:
              error instanceof Error && error.message
                ? error.message
                : 'Hubo un error al subir el archivo',
            retryable: true,
          };
          setErrors((current) => [...current, queueError]);
          setRetryableFiles((current) => [...current, file]);
          onError?.(queueError);
        }
      }

      setCurrentFileName(null);
      setProgress(0);
      setIsUploading(false);

      if (uploadedAny && entityId != null) {
        queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] });
      }
      onSettled?.();
    },
    [entityId, entityType, onError, onFileUploaded, onSettled, queryClient]
  );

  const retryFailed = useCallback(() => {
    const pending = retryableFiles;
    if (pending.length > 0) {
      void uploadFiles(pending);
    }
  }, [retryableFiles, uploadFiles]);

  const clearErrors = useCallback(() => {
    setErrors([]);
    setRetryableFiles([]);
  }, []);

  const state: UploadQueueState = {
    currentFileName,
    progress,
    isUploading,
    errors,
    retryableFiles,
  };

  return { ...state, uploadFiles, retryFailed, clearErrors };
}
