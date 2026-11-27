import React from 'react';
import { Card } from '@/shared/components/ui';
import styles from './DocumentAttachments.module.scss';
import type { DocsAttachment } from '../../types/docs.types';

interface DocumentAttachmentsProps {
  readonly attachments: readonly DocsAttachment[];
}

export function DocumentAttachments({ attachments }: DocumentAttachmentsProps) {
  const title = attachments.length > 0 ? `Adjuntos (${attachments.length})` : 'Adjuntos';
  return (
    <Card variant="panel" title={title} headingLevel="h2">
      {attachments.length === 0 ? (
        <p className={styles.empty}>Sin adjuntos.</p>
      ) : (
        <ul className={styles.list}>
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <a
                href={`/docs/attachments/${attachment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                {attachment.fileName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
