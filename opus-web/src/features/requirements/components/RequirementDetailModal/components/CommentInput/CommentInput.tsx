'use client';

import { useState, useRef, type FormEvent } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { useCreateComment } from '@/features/comments/hooks/useCreateComment';
import { attachmentsApi } from '@/features/attachments/services/attachmentsApi';
import { RichTextEditor } from '@/shared/components/ui/RichTextEditor/RichTextEditor';
import type { ApiError } from '@/lib/axios';
import styles from './CommentInput.module.scss';

/**
 * Validación de CONVENIENCIA, para fallar rápido sin ida y vuelta.
 *
 * NO es la fuente de verdad: el límite de tamaño y las listas de extensiones y MIME viven
 * en `system_settings` de `core` y son configurables en caliente. Por eso los mensajes no
 * nombran ningún número ni ninguna extensión — un valor escrito acá queda mintiendo sin
 * que nadie lo note. El rechazo autoritativo llega del servidor.
 */
const ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

interface CommentInputProps {
  requirementId: number;
}

interface PendingAttachment {
  /** Id de `files`: el archivo existe solo, sin vínculo. NO es un id de `attachments`. */
  fileId: number;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

function getErrorMessage(error: unknown): string {
  const apiError = error as ApiError | null;
  if (!apiError) return '';

  switch (apiError.code) {
    case 'file_not_owned':
      return 'No podés adjuntar un archivo que subió otra persona';
    case 'file_not_available':
      return 'El archivo no está disponible';
    case 'file_too_large':
      return 'El archivo supera el tamaño máximo permitido';
    case 'file_type_not_allowed':
      return 'Ese tipo de archivo no está permitido';
  }

  if (apiError.status === 403 || apiError.code === 'access_denied') {
    return 'Sin permiso para comentar';
  }
  return apiError.message || 'Error al enviar el comentario';
}

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function CommentInput({ requirementId }: CommentInputProps) {
  const [comment, setComment] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate, isPending, isError, error } = useCreateComment(requirementId);

  function handleCommentChange(newValue: string) {
    setComment(newValue);
    setPendingAttachments((prev) =>
      prev.filter((att) => newValue.includes(`attach:${att.fileId}`))
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';

    if (!file) return;
    // Se sube de a uno: mientras hay una subida en curso el botón está deshabilitado.
    if (uploading) return;
    setUploadError('');

    // Validación de conveniencia — ver la nota de ALLOWED_EXTENSIONS. Los mensajes son
    // los MISMOS que los del servidor, así que el usuario no distingue el origen.
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('El archivo supera el tamaño máximo permitido');
      return;
    }

    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError('Ese tipo de archivo no está permitido');
      return;
    }

    try {
      setUploading(true);
      setUploadingFileName(file.name);
      setUploadProgress(0);
      const uploaded = await attachmentsApi.uploadFile(file, setUploadProgress);
      const isImage = uploaded.mimeType.startsWith('image/');
      const placeholder = isImage ? `![attach:${uploaded.fileId}]` : `[attach:${uploaded.fileId}]`;

      setComment((prev) => prev + placeholder);
      setPendingAttachments((prev) => [
        ...prev,
        {
          fileId: uploaded.fileId,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          fileSize: uploaded.fileSize,
        },
      ]);
    } catch (error) {
      setUploadError(getErrorMessage(error) || 'Error al subir el archivo');
    } finally {
      // Los tres caminos limpian el estado de subida, o el editor queda con una barra
      // congelada para siempre.
      setUploading(false);
      setUploadingFileName('');
      setUploadProgress(0);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) return;

    mutate(
      { comment: trimmed, fileIds: pendingAttachments.map((a) => a.fileId) },
      {
        onSuccess: () => {
          setComment('');
          setPendingAttachments([]);
          setUploadError('');
        },
      }
    );
  }

  const hasContent = comment.trim() || pendingAttachments.length > 0;
  // Enviar mientras el byte viaja vincularía un archivo incompleto, y el sistema no
  // verifica que haya llegado.
  const isDisabled = !hasContent || isPending || uploading;
  const displayError = uploadError || (isError ? getErrorMessage(error) : '');

  return (
    <form className={styles.form} onSubmit={handleSubmit} data-testid="comment-input">
      {displayError && (
        <p className={styles.error} role="alert">
          {displayError}
        </p>
      )}
      <div className={styles.inputBox}>
        <div className={styles.scrollArea}>
          <RichTextEditor
            value={comment}
            onChange={handleCommentChange}
            attachmentMeta={pendingAttachments.map((a) => ({
              id: a.fileId,
              fileName: a.fileName,
              mimeType: a.mimeType,
              fileSize: a.fileSize,
            }))}
            placeholder="Escribe un comentario..."
            disabled={isPending}
            uploading={uploading}
            uploadingFileName={uploadingFileName}
            uploadProgress={uploadProgress}
          />
        </div>
        <div className={styles.toolbar}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
            className={styles.fileInput}
            onChange={handleFileChange}
            aria-label="Adjuntar archivo"
          />
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Adjuntar archivo al comentario"
            disabled={isPending || uploading}
          >
            <Paperclip size={16} aria-hidden="true" />
            Adjuntar
          </button>
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={isDisabled}
            aria-label="Enviar comentario"
          >
            <Send size={16} aria-hidden="true" />
            Enviar
          </button>
        </div>
      </div>
    </form>
  );
}
