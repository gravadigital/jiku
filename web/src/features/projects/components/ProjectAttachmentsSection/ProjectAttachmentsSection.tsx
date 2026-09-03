'use client';

import { AttachmentsList, FileUploader } from '@/features/attachments';
import { useCanUploadToProject } from '@/features/projects/hooks/useCanUploadToProject';
import { Card } from '@/shared/components/ui';
import styles from './ProjectAttachmentsSection.module.scss';

interface ProjectAttachmentsSectionProps {
  readonly projectId: number;
}

export function ProjectAttachmentsSection({ projectId }: ProjectAttachmentsSectionProps) {
  const canUpload = useCanUploadToProject();

  return (
    <Card variant="panel" title="Archivos Adjuntos" headingLevel="h2">
      {canUpload && <FileUploader entityType="project" entityId={projectId} />}
      <div className={styles.listWrapper}>
        <AttachmentsList entityType="project" entityId={projectId} />
      </div>
    </Card>
  );
}
