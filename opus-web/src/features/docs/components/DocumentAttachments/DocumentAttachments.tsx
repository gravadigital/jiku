import { Download } from 'lucide-react';
import type { DocsAttachment } from '../../types/docs.types';
import styles from './DocumentAttachments.module.scss';

interface DocumentAttachmentsProps {
  attachments?: DocsAttachment[];
}

/**
 * Lista de adjuntos. El `href` se arma con el `id` hacia el proxy propio, nunca con `link`
 * (que apunta a la web interna del equipo).
 */
export function DocumentAttachments({ attachments }: DocumentAttachmentsProps) {
  if (!attachments?.length) return null;
  return (
    <aside className={styles.attachments}>
      <h3 className={styles.title}>Adjuntos</h3>
      <ul className={styles.list}>
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <a
              className={styles.link}
              href={`/api/docs/attachments/${attachment.id}`}
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
