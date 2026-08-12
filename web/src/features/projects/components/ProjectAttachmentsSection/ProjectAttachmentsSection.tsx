'use client';

import { AttachmentsList, FileUploader } from '@/features/attachments';
import { useCanUploadToProject } from '@/features/projects/hooks/useCanUploadToProject';
import styles from './ProjectAttachmentsSection.module.scss';

interface ProjectAttachmentsSectionProps {
  readonly projectId: number;
}

export function ProjectAttachmentsSection({ projectId }: ProjectAttachmentsSectionProps) {
  const canUpload = useCanUploadToProject();

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Archivos Adjuntos</h2>
      {canUpload && <FileUploader entityType="project" entityId={projectId} />}
      <div style={{ marginTop: '0.75rem' }}>
        <AttachmentsList entityType="project" entityId={projectId} />
      </div>
    </div>
  );
}
