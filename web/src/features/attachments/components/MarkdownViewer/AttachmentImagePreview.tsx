'use client';
import React from 'react';
import { AttachmentPreview } from '@/shared/components/ui/AttachmentPreview/AttachmentPreview';
import { useAttachmentMeta } from '../../hooks/useAttachmentMeta';
import styles from './AttachmentPlaceholder.module.scss';
import type { AttachmentResource } from '../../types/attachment.types';

interface AttachmentImagePreviewProps {
  readonly attachmentId: number;
  /** Espacio de identificadores. Ver `AttachmentResource`. */
  readonly resource?: AttachmentResource;
  readonly fileName?: string;
}

/**
 * Resuelve la metadata (nombre, tamaño, mimeType) de un adjunto ya guardado
 * y renderiza AttachmentPreview — el mismo componente que usa el input de
 * comentario/descripción para imágenes — para que Actividad se vea igual
 * que el input en vez de usar un componente propio.
 */
export function AttachmentImagePreview({
  attachmentId,
  resource = 'attachment',
  fileName,
}: AttachmentImagePreviewProps) {
  const { data, isLoading, isError, error } = useAttachmentMeta(attachmentId, resource);

  if (isLoading) {
    return (
      <span
        className={styles.loading}
        data-testid="attachment-image-preview-loading"
        aria-busy="true"
        aria-label="Cargando adjunto"
      >
        <span className={styles.skeletonBar} aria-hidden="true" />
      </span>
    );
  }

  if (isError) {
    if (error?.status === 403) {
      return (
        <span className={styles.errorCard} role="note">
          No tenés permisos para acceder a este adjunto
        </span>
      );
    }
    if (error?.status === 404) {
      return (
        <span className={styles.errorCard} role="note">
          El archivo no está disponible
        </span>
      );
    }
    return (
      <span className={styles.errorCard} role="note">
        {`Adjunto no disponible (ID: ${attachmentId})`}
      </span>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <AttachmentPreview
      attachmentId={attachmentId}
      resource={resource}
      fileName={fileName || data.fileName}
      mimeType={data.mimeType}
      fileSize={data.fileSize}
    />
  );
}
