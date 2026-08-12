'use client';

import { useState } from 'react';
import styles from './AttachmentPreview.module.scss';

interface AttachmentPreviewProps {
  attachmentId: number;
  fileName: string;
  previewUrl: string;
  mimeType: string;
  fileSize?: number;
  onRemove?: () => void;
}

export function AttachmentPreview({
  attachmentId,
  fileName,
  previewUrl,
  mimeType,
  onRemove,
}: AttachmentPreviewProps) {
  const [failed, setFailed] = useState(false);
  const isPdf = mimeType === 'application/pdf';
  const displayName = fileName || 'Archivo adjunto';

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
      return <span className={styles.fallback}>archivo no disponible</span>;
    }

    return (
      <img
        src={previewUrl}
        alt={displayName}
        loading="lazy"
        className={styles.image}
        onError={() => setFailed(true)}
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
      {!isPdf && <span className={styles.fileName}>{displayName}</span>}
    </div>
  );
}
