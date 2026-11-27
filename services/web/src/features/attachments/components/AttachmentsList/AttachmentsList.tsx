'use client';
import { useState } from 'react';
import { useCanEditObjective } from '@/features/objectives/hooks/useCanEditObjective';
import { useCanUploadToProject } from '@/features/projects/hooks/useCanUploadToProject';
import { Loader } from '@/shared/components/ui';
import { useAttachments } from '../../hooks/useAttachments';
import { AttachmentItem } from '../AttachmentItem';
import { PreviewModal } from '../PreviewModal';
import styles from './AttachmentsList.module.scss';
import type { Attachment, EntityType } from '../../types/attachment.types';

interface AttachmentsListProps {
  readonly entityType: EntityType;
  readonly entityId: number;
}

const BATCH_SIZE = 3;

function useCanDelete(entityType: EntityType, entityId: number): boolean {
  const canEditObjective = useCanEditObjective(entityType === 'objective' ? entityId : 0);
  const canUploadToProject = useCanUploadToProject();
  return entityType === 'objective' ? canEditObjective : canUploadToProject;
}

export function AttachmentsList({ entityType, entityId }: AttachmentsListProps) {
  const canDelete = useCanDelete(entityType, entityId);
  const { data: attachments, isLoading, error } = useAttachments(entityType, entityId);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Loader label="Cargando archivos..." />
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>Error al cargar archivos</div>;
  }

  if (!attachments || attachments.length === 0) {
    return <div className={styles.empty}>No hay archivos adjuntos</div>;
  }

  const showMore = attachments.length > visibleCount;
  const visibleAttachments = attachments.slice(0, visibleCount);

  const handleShowMore = () => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, attachments.length));
  };

  return (
    <>
      <div className={styles.list}>
        {visibleAttachments.map((attachment) => (
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            onPreview={() => setPreviewAttachment(attachment)}
            canDelete={canDelete}
          />
        ))}
      </div>

      {showMore && (
        <button type="button" className={styles.verMas} onClick={handleShowMore}>
          Ver más
        </button>
      )}

      {previewAttachment && (
        <PreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      )}
    </>
  );
}
