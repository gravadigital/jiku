'use client';

import React, { useState } from 'react';
import { Dropzone } from '@/shared/components/ui';
import { useUploadDocAttachment } from '../../hooks/useUploadDocAttachment';
import { attachmentMarkdown } from '../../utils/attachmentMarkdown';
import { attachmentErrorMessage } from '../../utils/docsErrors';
import styles from './DocumentAttachZone.module.scss';

interface DocumentAttachZoneProps {
  readonly documentId: string;
  /** Recibe el enlace markdown del adjunto ya confirmado, para insertarlo en el texto. */
  readonly onUploaded: (markdown: string) => void;
}

// Zona de adjuntos: de a un archivo por vez, con el tamaño máximo por defecto del `Dropzone`
// (P-16). El `Dropzone` trae su propio texto; el nombre del archivo va en una línea `aria-live`.
export function DocumentAttachZone({ documentId, onUploaded }: DocumentAttachZoneProps) {
  const upload = useUploadDocAttachment(documentId);
  const [fileName, setFileName] = useState('');

  const handleFiles = (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);
    upload.mutate(file, {
      onSuccess: (result) => onUploaded(attachmentMarkdown(result)),
    });
  };

  return (
    <div className={styles.zone}>
      <Dropzone
        multiple={false}
        onFiles={handleFiles}
        uploading={upload.isPending}
        error={upload.isError ? attachmentErrorMessage(upload.error) : undefined}
      />
      <p className={styles.status} aria-live="polite">
        {upload.isPending ? `Subiendo ${fileName}…` : ''}
      </p>
    </div>
  );
}
