'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { AttachmentPlaceholder } from '@/features/attachments/components/MarkdownViewer/AttachmentPlaceholder';
import { uploadFile } from '@/features/attachments/services/attachmentsClientApi';
import { fileErrorMessage } from '@/features/attachments/utils/fileErrorMessages';
import { createComment } from '@/features/objectives';
import { AttachFileButton } from '@/shared/components/ui/AttachFileButton';
import { Button } from '@/shared/components/ui/Button';
import {
  InlineCommentEditor,
  type InlineCommentEditorHandle,
} from '@/shared/components/ui/InlineCommentEditor';
import styles from './CommentEditor.module.scss';

/**
 * Un archivo ya subido al storage y todavía SIN vincular al comentario. `id` es
 * un `fileId` (id de `files`), no un id de vínculo: el vínculo se crea recién
 * al guardar, mandando estos ids en `fileIds`.
 */
interface PendingAttachment {
  readonly id: number;
  readonly kind: 'image' | 'file';
  readonly fileName: string;
}

interface UploadState {
  readonly fileName: string;
  readonly progress: number;
}

interface CommentEditorProps {
  readonly objectiveId: number;
}

export function CommentEditor(props: CommentEditorProps) {
  const { objectiveId } = props;
  const [loading, setLoading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  // La subida es una espera DISTINTA de la del guardado: tiene porcentaje. Por
  // eso no se colapsa con `loading` en un mismo spinner.
  const [upload, setUpload] = useState<UploadState | null>(null);
  const isUploading = upload !== null;
  const editorRef = useRef<InlineCommentEditorHandle>(null);
  const { push } = useRouter();

  const handleChange = (markdown: string) => {
    setIsEmpty(markdown.trim().length === 0 && attachments.length === 0);
  };

  const handleFileReady = async (file: File) => {
    setUpload({ fileName: file.name, progress: 0 });
    try {
      const fileId = await uploadFile(file, {
        onProgress: (progress) => setUpload({ fileName: file.name, progress }),
      });
      setAttachments((prev) => [
        ...prev,
        {
          id: fileId,
          kind: file.type.startsWith('image/') ? 'image' : 'file',
          fileName: file.name,
        },
      ]);
      setIsEmpty(false);
    } catch (error) {
      const message =
        error instanceof Error && error.message.toLowerCase().includes('permission')
          ? 'No tenés permisos para subir archivos a esta tarea'
          : fileErrorMessage(error, 'Hubo un error al subir el archivo');
      toast.error(message);
    } finally {
      setUpload(null);
    }
  };

  /**
   * Quitar saca el archivo del comentario en curso. NO borra nada: el archivo
   * sigue existiendo sin vínculo, que es un estado válido. Por eso la acción no
   * pide confirmación.
   */
  const handleRemoveAttachment = (id: number) => {
    setAttachments((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (next.length === 0 && (editorRef.current?.getValue() ?? '').trim().length === 0) {
        setIsEmpty(true);
      }
      return next;
    });
  };

  const buildComment = () => {
    const text = editorRef.current?.getValue() ?? '';
    // La URL embebida apunta a la ruta de ARCHIVOS, no a la de vínculos: en
    // este punto el vínculo todavía no existe y su id no se conoce.
    const attachmentMarkdown = attachments
      .map((a) =>
        a.kind === 'image'
          ? `![${a.fileName}](/api/files/${a.id}/preview)`
          : `[${a.fileName}](/api/files/${a.id}/preview)`
      )
      .join('\n');
    return attachmentMarkdown ? `${text}\n${attachmentMarkdown}` : text;
  };

  const handleSubmit = () => {
    const comment = buildComment();
    if (!comment.trim()) {
      toast.error('El comentario no puede estar vacío');
      return;
    }
    setLoading(true);
    createComment(objectiveId, {
      comment,
      visibilityLevel: isPublic ? 'public' : 'internal',
      fileIds: attachments.map((a) => a.id),
    })
      .then(() => {
        toast.success('Comentario agregado exitosamente');
        editorRef.current?.clear();
        setAttachments([]);
        setIsPublic(false);
        setIsEmpty(true);
        setLoading(false);
        push(`/objectives/${objectiveId}`);
      })
      .catch((error: unknown) => {
        toast.error(fileErrorMessage(error, 'Hubo un error al agregar el comentario'));
        setLoading(false);
      });
  };

  return (
    <div>
      <div className={styles.textBoxContainer}>
        <InlineCommentEditor
          ref={editorRef}
          ariaLabel="Comentario"
          placeholder="Escribe un comentario..."
          onChange={handleChange}
          disabled={loading}
        />
        {attachments.length > 0 && (
          <div className={styles.pendingAttachmentList}>
            {attachments.map((a) => (
              <div key={a.id} className={styles.attachmentRow}>
                <AttachmentPlaceholder attachmentId={a.id} resource="file" fileName={a.fileName} />
                <button
                  type="button"
                  className={styles.removeAttachment}
                  onClick={() => handleRemoveAttachment(a.id)}
                  aria-label="Quitar adjunto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {upload && (
        <div className={styles.uploadProgress}>
          <p className={styles.uploadProgressText}>
            Subiendo {upload.fileName}... {upload.progress}%
          </p>
          <div
            className={styles.uploadProgressBar}
            role="progressbar"
            aria-valuenow={upload.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={styles.uploadProgressFill} style={{ width: `${upload.progress}%` }} />
          </div>
        </div>
      )}

      <div className={styles.bottom}>
        <label className={styles.visibilityCheckbox}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Comentario público (visible para usuarios externos)
        </label>
        <AttachFileButton onFileReady={handleFileReady} disabled={loading || isUploading} />
        <Button
          key="save-comment"
          onClick={handleSubmit}
          loading={loading}
          disabled={isEmpty || isUploading}
          ariaDescribedBy={isUploading ? 'comment-upload-in-progress' : undefined}
        >
          Guardar
        </Button>
        {isUploading && (
          <span id="comment-upload-in-progress" className={styles.srOnly}>
            Hay una subida en curso: esperá a que el archivo termine de subir para guardar
          </span>
        )}
      </div>
    </div>
  );
}
