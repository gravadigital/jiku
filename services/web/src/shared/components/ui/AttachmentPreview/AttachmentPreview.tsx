'use client';

import { useState } from 'react';
import {
  getFilePreviewUrl,
  getPreviewUrl,
} from '@/features/attachments/services/attachmentsClientApi';
import styles from './AttachmentPreview.module.scss';
import type { AttachmentResource } from '@/features/attachments/types/attachment.types';

interface AttachmentPreviewProps {
  attachmentId: number;
  /**
   * Espacio de identificadores de `attachmentId`. `file` resuelve el preview
   * por `/api/files/{id}/preview`, que es el camino de un archivo todavía sin
   * vínculo.
   */
  resource?: AttachmentResource;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  onRemove?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPreview({
  attachmentId,
  resource = 'attachment',
  fileName,
  mimeType,
  fileSize,
  onRemove,
}: AttachmentPreviewProps) {
  const previewUrl =
    resource === 'file' ? getFilePreviewUrl(attachmentId) : getPreviewUrl(attachmentId);
  // El fallo se recuerda POR URL, no de forma indefinida: `failed` a secas sobrevivía al
  // cambio de adjunto, así que un id nuevo en el mismo nodo del editor seguía mostrando el
  // "no está disponible" del anterior. Guardar la url que falló hace que el reset sea
  // automático y sin `useEffect`.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === previewUrl;
  const isPdf = mimeType === 'application/pdf';
  const displayName = fileName || 'Archivo adjunto';
  const sizeLabel = fileSize !== undefined ? formatFileSize(fileSize) : null;

  function renderMedia() {
    if (isPdf) {
      return (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.pdfLink}
          aria-label={displayName}
        >
          <span className={styles.fileName}>{displayName}</span>
        </a>
      );
    }
    if (failed) {
      return <span className={styles.fallback}>El archivo no está disponible</span>;
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt={displayName}
        loading="lazy"
        className={styles.image}
        onError={() => setFailedUrl(previewUrl)}
      />
    );
  }

  return (
    <div className={styles.wrapper} data-attachment-id={attachmentId}>
      <div className={styles.mediaContainer}>
        {renderMedia()}
        {!isPdf && !failed && onRemove && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onRemove}
            aria-label="Eliminar adjunto"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path
                d="M1 1l8 8M9 1L1 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        {!isPdf && !failed && !onRemove && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={displayName}
            className={styles.actionBtn}
            aria-label="Descargar adjunto"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>
        )}
      </div>
      {!isPdf && (
        <span className={styles.fileName}>
          {displayName}
          {sizeLabel && <span className={styles.fileSize}> · {sizeLabel}</span>}
        </span>
      )}
    </div>
  );
}
