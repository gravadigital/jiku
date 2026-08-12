'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { AttachmentPlaceholder } from '@/features/attachments/components/MarkdownViewer/AttachmentPlaceholder';
import { useUploadAttachment } from '@/features/attachments/hooks/useUploadAttachment';
import { createComment } from '@/features/objectives';
import { AttachFileButton } from '@/shared/components/ui/AttachFileButton';
import { Button } from '@/shared/components/ui/Button';
import {
  InlineCommentEditor,
  type InlineCommentEditorHandle,
} from '@/shared/components/ui/InlineCommentEditor';
import styles from './CommentEditor.module.scss';

interface AttachmentEntry {
  readonly id: number;
  readonly kind: 'image' | 'file';
  readonly fileName: string;
}

interface CommentEditorProps {
  readonly objectiveId: number;
}

export function CommentEditor(props: CommentEditorProps) {
  const { objectiveId } = props;
  const [loading, setLoading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([]);
  const editorRef = useRef<InlineCommentEditorHandle>(null);
  const { push } = useRouter();

  const { mutate: upload, isPending: isUploading } = useUploadAttachment({
    onError: (err) => {
      const msg = err.message.toLowerCase().includes('permission')
        ? 'No tenés permisos para subir archivos a esta tarea'
        : err.message;
      toast.error(msg);
    },
  });

  const handleChange = (markdown: string) => {
    setIsEmpty(markdown.trim().length === 0 && attachments.length === 0);
  };

  const handleFileReady = (file: File) => {
    upload(
      { entityType: 'objective_comment_draft', entityId: objectiveId, files: [file] },
      {
        onSuccess: (uploaded) => {
          const attachment = uploaded[0];
          if (!attachment) return;
          const kind = attachment.mimeType.startsWith('image/') ? 'image' : 'file';
          setAttachments((prev) => [
            ...prev,
            { id: attachment.id, kind, fileName: attachment.fileName },
          ]);
          setIsEmpty(false);
        },
      }
    );
  };

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
    const attachmentMarkdown = attachments
      .map((a) =>
        a.kind === 'image'
          ? `![${a.fileName}](/api/attachments/${a.id}/preview)`
          : `[${a.fileName}](/api/attachments/${a.id}/preview)`
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
      attachmentIds: attachments.map((a) => a.id),
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
      .catch(() => {
        toast.error('Hubo un error al agregar el comentario');
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
          <div className={styles.attachmentList}>
            {attachments.map((a) => (
              <div key={a.id} className={styles.attachmentRow}>
                <AttachmentPlaceholder attachmentId={a.id} fileName={a.fileName} />
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
          label="Guardar"
          onClick={handleSubmit}
          loading={loading || isUploading}
          disabled={isEmpty}
        />
      </div>
    </div>
  );
}
