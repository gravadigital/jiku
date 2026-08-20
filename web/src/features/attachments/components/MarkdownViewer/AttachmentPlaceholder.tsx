'use client';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '@/shared/components/ui/Button';
import { useAttachmentMeta } from '../../hooks/useAttachmentMeta';
import { getDownloadUrl, getFilePreviewUrl } from '../../services/attachmentsClientApi';
import { getFileIcon } from '../../utils/fileIcons';
import styles from './AttachmentPlaceholder.module.scss';
import type { AttachmentResource } from '../../types/attachment.types';

interface AttachmentPlaceholderProps {
  readonly attachmentId: number;
  /**
   * Espacio de identificadores de `attachmentId`. `attachment` (default) es un
   * vínculo ya guardado; `file` es un archivo recién subido y todavía sin
   * vincular, que se lee por `/api/files/{id}/preview`.
   */
  readonly resource?: AttachmentResource;
  readonly fileName?: string;
  /**
   * Cuando se provee, reemplaza los botones Preview/Descargar por un único
   * botón "Eliminar" — usado en editores donde el adjunto todavía no se
   * confirmó (ej. input de comentario) y el usuario puede quitarlo.
   */
  readonly onRemove?: () => void;
}

function formatFileSize(bytes?: number): string | null {
  if (bytes === undefined || Number.isNaN(bytes)) {
    return null;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPlaceholder({
  attachmentId,
  resource = 'attachment',
  fileName,
  onRemove,
}: AttachmentPlaceholderProps) {
  const { data, isLoading, isError, error } = useAttachmentMeta(attachmentId, resource);
  const [isDownloading, setIsDownloading] = useState(false);

  if (isLoading) {
    return (
      <span
        className={styles.loading}
        data-testid="attachment-placeholder-loading"
        aria-busy="true"
        aria-label="Cargando adjunto"
      >
        <span className={styles.skeletonBar} aria-hidden="true" />
      </span>
    );
  }

  if (isError) {
    // Tres casos distintos, y hay que decirlos distinto: permisos, byte que
    // nunca llegó al storage, y error genérico.
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

  const displayName = fileName || data.fileName;
  const sizeLabel = formatFileSize(data.fileSize);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // LA RUTA DEPENDE DEL ESPACIO DE IDS, y no es opcional: con `resource: 'file'` el id es
      // de `files`, no de vínculo. Pegarle a `/api/attachments/{id}/download` con un id de
      // archivo NO da 404 — los dos espacios se solapan, así que un id que existe en las dos
      // tablas descarga **el archivo equivocado, en silencio**.
      //
      // Para un archivo sin vínculo se usa el preview: es el único camino por `fileId` que la
      // api expone, y alcanza porque el `link.download` de abajo pone el nombre — el binario
      // llega igual y el usuario lo guarda con su nombre real.
      const url = resource === 'file' ? getFilePreviewUrl(attachmentId) : getDownloadUrl(attachmentId);
      const response = await fetch(url);
      if (response.status === 403) {
        toast.error('No tenés permisos para descargar este archivo');
        return;
      }
      if (!response.ok) {
        toast.error('Error al descargar el archivo');
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = displayName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('Error al descargar el archivo');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <span className={styles.card}>
      <span className={styles.icon} aria-hidden="true">
        {getFileIcon(data.mimeType)}
      </span>
      <span className={styles.info}>
        <span className={styles.fileName} title={displayName}>
          {displayName}
        </span>
      </span>
      <span className={styles.actions}>
        {sizeLabel && <span className={styles.sizeInline}>{sizeLabel}</span>}
        {onRemove ? (
          <Button label="Eliminar" onClick={onRemove} size="small" variant="secondary" />
        ) : (
          <Button
            label="Descargar"
            onClick={handleDownload}
            size="small"
            variant="secondary"
            disabled={isDownloading}
            loading={isDownloading}
          />
        )}
      </span>
    </span>
  );
}
