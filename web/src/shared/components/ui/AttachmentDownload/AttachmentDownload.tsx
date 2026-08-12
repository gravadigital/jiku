import {
  getPreviewUrl,
  getDownloadUrl,
} from '@/features/attachments/services/attachmentsClientApi';
import { getFileIcon } from '@/features/attachments/utils/fileIcons';
import styles from './AttachmentDownload.module.scss';

interface AttachmentDownloadProps {
  attachmentId: number;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  onRemove?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentDownload({
  attachmentId,
  fileName,
  fileSize,
  mimeType,
  onRemove,
}: AttachmentDownloadProps) {
  const displayName = fileName || 'Archivo adjunto';
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const href = isPdf ? getPreviewUrl(attachmentId) : getDownloadUrl(attachmentId);

  return (
    <div className={styles.wrapper}>
      <div className={styles.iconWrap}>
        {mimeType ? (
          getFileIcon(mimeType)
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...(!isPdf && { download: displayName })}
        className={styles.name}
      >
        {displayName}
      </a>

      {fileSize !== undefined && <span className={styles.size}>{formatFileSize(fileSize)}</span>}

      {onRemove ? (
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
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...(!isPdf && { download: displayName })}
          className={styles.downloadBtn}
          aria-label="Descargar adjunto"
        >
          <svg
            width="16"
            height="16"
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
  );
}
