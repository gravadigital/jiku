'use client';
import { useEffect, useRef, useState } from 'react';
import { getPreviewUrl } from '../../services/attachmentsClientApi';
import styles from './PreviewModal.module.scss';
import type { Attachment } from '../../types/attachment.types';

type PreviewableAttachment = Pick<Attachment, 'id' | 'fileName' | 'mimeType'>;

interface PreviewModalProps {
  readonly attachment: PreviewableAttachment;
  readonly onClose: () => void;
}

export function getPreviewType(mimeType: string): 'image' | 'pdf' | 'unsupported' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'unsupported';
}

export function PreviewModal({ attachment, onClose }: PreviewModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previewType = getPreviewType(attachment.mimeType);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'forbidden' | 'error' | 'ready'>(
    'loading'
  );

  useEffect(() => {
    if (previewType !== 'image') {
      setFetchStatus('ready');
      return;
    }
    let objectUrl: string;
    setFetchStatus('loading');
    fetch(getPreviewUrl(attachment.id))
      .then((res) => {
        if (res.status === 403) {
          setFetchStatus('forbidden');
          return null;
        }
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then((blob) => {
        if (!blob) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setFetchStatus('ready');
      })
      .catch(() => setFetchStatus('error'));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, previewType]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${attachment.fileName}`}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.fileName}>{attachment.fileName}</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar vista previa"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {previewType === 'image' && fetchStatus === 'loading' && (
            <p className={styles.unsupportedMessage}>Cargando vista previa...</p>
          )}
          {previewType === 'image' && fetchStatus === 'forbidden' && (
            <p className={styles.unsupportedMessage}>
              No tenés permisos para visualizar este archivo
            </p>
          )}
          {previewType === 'image' && fetchStatus === 'error' && (
            <p className={styles.unsupportedMessage}>Error al cargar la vista previa</p>
          )}
          {previewType === 'image' && fetchStatus === 'ready' && blobUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={blobUrl} alt={attachment.fileName} className={styles.image} />
          )}
          {previewType === 'pdf' && (
            <iframe
              src={getPreviewUrl(attachment.id)}
              className={styles.pdfFrame}
              title={attachment.fileName}
            />
          )}
          {previewType === 'unsupported' && (
            <p className={styles.unsupportedMessage}>
              Este tipo de archivo no tiene vista previa disponible
            </p>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
