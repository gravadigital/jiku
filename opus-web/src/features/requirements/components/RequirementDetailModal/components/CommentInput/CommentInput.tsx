'use client';

import { useState, useRef, type FormEvent } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { useCreateComment } from '@/features/comments/hooks/useCreateComment';
import { attachmentsApi } from '@/features/attachments/services/attachmentsApi';
import { RichTextEditor } from '@/shared/components/ui/RichTextEditor/RichTextEditor';
import type { ApiError } from '@/lib/axios';
import styles from './CommentInput.module.scss';

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
  id: number;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

function getErrorMessage(error: unknown): string {
  const apiError = error as ApiError | null;
  if (!apiError) return '';
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
  const [uploadingMimeType, setUploadingMimeType] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate, isPending, isError, error } = useCreateComment(requirementId);

  function handleCommentChange(newValue: string) {
    setComment(newValue);
    setPendingAttachments((prev) => prev.filter((att) => newValue.includes(`attach:${att.id}`)));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';

    if (!file) return;
    setUploadError('');

    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('El archivo supera el límite de 10MB');
      return;
    }

    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError('Tipo de archivo no permitido');
      return;
    }

    try {
      const mimeGuess = file.type;
      setUploading(true);
      setUploadingMimeType(mimeGuess);
      const [attachment] = await attachmentsApi.uploadFile(
        'requirement_comment_draft',
        requirementId,
        file
      );
      const isImage = attachment.mimeType.startsWith('image/');
      const placeholder = isImage ? `![attach:${attachment.id}]` : `[attach:${attachment.id}]`;

      setComment((prev) => prev + placeholder);
      setPendingAttachments((prev) => [
        ...prev,
        {
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize,
        },
      ]);
    } catch {
      setUploadError('Error al subir el archivo');
    } finally {
      setUploading(false);
      setUploadingMimeType('');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) return;

    mutate(
      { comment: trimmed, attachmentIds: pendingAttachments.map((a) => a.id) },
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
  const isDisabled = !hasContent || isPending;
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
            attachmentMeta={pendingAttachments}
            placeholder="Escribe un comentario..."
            disabled={isPending}
            uploading={uploading}
            uploadingMimeType={uploadingMimeType}
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
            disabled={isPending}
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
