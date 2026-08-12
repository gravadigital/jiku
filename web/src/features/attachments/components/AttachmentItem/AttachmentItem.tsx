'use client';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { Button, ConfirmDialog } from '@/shared/components/ui';
import { formatDate } from '@/shared/utils';
import { useDeleteAttachment } from '../../hooks/useDeleteAttachment';
import { getDownloadUrl } from '../../services/attachmentsClientApi';
import { getFileIcon } from '../../utils/fileIcons';
import { getPreviewType } from '../PreviewModal';
import styles from './AttachmentItem.module.scss';
import type { Attachment } from '../../types/attachment.types';

interface AttachmentItemProps {
  readonly attachment: Attachment;
  readonly onPreview: () => void;
  readonly canDelete?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentItem({ attachment, onPreview, canDelete = false }: AttachmentItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { mutate: deleteAttachment, isPending: isDeleting } = useDeleteAttachment();

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const url = getDownloadUrl(attachment.id);
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
      link.download = attachment.fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('Error al descargar el archivo');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConfirmDelete = () => {
    deleteAttachment(attachment.id, {
      onSuccess: () => setShowDeleteDialog(false),
      onError: () => setShowDeleteDialog(false),
    });
  };

  return (
    <div className={styles.item}>
      <div className={styles.topRow}>
        <div className={styles.icon} aria-hidden="true">
          {getFileIcon(attachment.mimeType)}
        </div>
        <div className={styles.info}>
          <span className={styles.fileName} title={attachment.fileName}>
            {attachment.fileName}
          </span>
          <span className={styles.meta}>
            {formatFileSize(attachment.fileSize)} &middot;{' '}
            {formatDate(new Date(attachment.createdAt))} &middot; {attachment.uploader.name}
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        {getPreviewType(attachment.mimeType) !== 'unsupported' && (
          <Button label="Preview" onClick={onPreview} size="small" variant="secondary" />
        )}
        <Button
          label="Download"
          onClick={handleDownload}
          size="small"
          variant="secondary"
          disabled={isDownloading}
          loading={isDownloading}
        />
        {canDelete && (
          <Button
            label="Eliminar"
            onClick={() => setShowDeleteDialog(true)}
            size="small"
            disabled={isDeleting}
            loading={isDeleting}
          />
        )}
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        title="Eliminar archivo"
        message="¿Estás seguro? El archivo se eliminará permanentemente en 7 días"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
