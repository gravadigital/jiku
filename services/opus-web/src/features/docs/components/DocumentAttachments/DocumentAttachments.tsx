import { Download } from 'lucide-react';
import type { DocsAttachment } from '../../types/docs.types';
import styles from './DocumentAttachments.module.scss';

interface DocumentAttachmentsProps {
  attachments?: DocsAttachment[];
  documentId: string;
}

/**
 * Lista de adjuntos. El `href` se arma hacia el proxy propio con el documento y el adjunto
 * (`/api/docs/documents/{documentId}/attachments/{id}`, REQ-017 DD-2): el `documentId` del
 * adjunto o, si faltara, el del documento abierto. Nunca con `link` (que apunta a la web
 * interna del equipo).
 */
export function DocumentAttachments({ attachments, documentId }: DocumentAttachmentsProps) {
  if (!attachments?.length) return null;
  return (
    <aside className={styles.attachments}>
      <h3 className={styles.title}>Adjuntos</h3>
      <ul className={styles.list}>
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <a
              className={styles.link}
              href={`/api/docs/documents/${attachment.documentId ?? documentId}/attachments/${attachment.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={16} aria-hidden="true" />
              <span>{attachment.fileName}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
