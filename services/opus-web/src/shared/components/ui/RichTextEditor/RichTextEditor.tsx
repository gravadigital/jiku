'use client';

import { useEffect, useState, useCallback } from 'react';
import { AttachmentPreview } from '../AttachmentPreview/AttachmentPreview';
import { AttachmentDownload } from '../AttachmentDownload/AttachmentDownload';
import { attachmentsApi } from '@/features/attachments/services/attachmentsApi';
import styles from './RichTextEditor.module.scss';

export interface AttachmentMeta {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  attachmentMeta?: AttachmentMeta[];
  placeholder?: string;
  disabled?: boolean;
  uploading?: boolean;
  /** Nombre del archivo en curso, para el microcopy del bloque de progreso. */
  uploadingFileName?: string;
  /** Porcentaje real del `PUT` a S3, 0-100. */
  uploadProgress?: number;
}

type EditorSegment =
  | { type: 'text'; value: string }
  | { type: 'attachment'; id: number; fileName: string; mimeType: string; fileSize?: number };

/**
 * Acepta los dos prefijos AL LEER —`file:` es el que se escribe hoy, `attach:` quedó en los
 * comentarios que se guardaron antes— pero en este editor el id es SIEMPRE de `files`: el
 * vínculo todavía no existe. Por eso el preview va por `getFilePreviewUrl` y la serialización
 * de abajo emite `file:` en los dos casos.
 */
const PLACEHOLDER_REGEX = /(!?\[(?:attach|file):(\d+)\])/g;

function parseToSegments(content: string, meta: AttachmentMeta[]): EditorSegment[] {
  const metaMap = new Map(meta.map((m) => [m.id, m]));
  const segments: EditorSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    // texto antes del placeholder
    segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });

    const isImage = match[1].startsWith('!');
    const id = parseInt(match[2], 10);
    const m = metaMap.get(id);
    segments.push({
      type: 'attachment',
      id,
      fileName: m?.fileName ?? '',
      mimeType: m?.mimeType ?? (isImage ? 'image/jpeg' : 'application/octet-stream'),
      fileSize: m?.fileSize,
    });

    lastIndex = match.index + match[0].length;
  }

  // texto restante (o vacío si termina en adjunto)
  segments.push({ type: 'text', value: content.slice(lastIndex) });

  return segments;
}

function serializeSegments(segments: EditorSegment[]): string {
  return segments
    .map((s) => {
      if (s.type === 'text') return s.value;
      // Se emite `file:` siempre: el id de este editor es de `files`. Un `attach:` acá haría
      // que el comentario guardado apuntara al espacio de ids equivocado.
      return s.mimeType.startsWith('image/') ? `![file:${s.id}]` : `[file:${s.id}]`;
    })
    .join('');
}

export function RichTextEditor({
  value,
  onChange,
  attachmentMeta = [],
  placeholder,
  disabled,
  uploading = false,
  uploadingFileName = '',
  uploadProgress = 0,
}: RichTextEditorProps) {
  const [segments, setSegments] = useState<EditorSegment[]>(() =>
    parseToSegments(value, attachmentMeta)
  );

  useEffect(() => {
    setSegments(parseToSegments(value, attachmentMeta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleTextChange = useCallback(
    (index: number, newText: string) => {
      const updated = segments.map((s, i) =>
        i === index && s.type === 'text' ? { ...s, value: newText } : s
      );
      setSegments(updated);
      onChange(serializeSegments(updated));
    },
    [segments, onChange]
  );

  const handleRemove = useCallback(
    (id: number) => {
      const filtered = segments.filter((s) => !(s.type === 'attachment' && s.id === id));
      // fusionar segmentos de texto adyacentes que quedaron juntos
      const merged: EditorSegment[] = [];
      for (const seg of filtered) {
        const prev = merged[merged.length - 1];
        if (seg.type === 'text' && prev?.type === 'text') {
          merged[merged.length - 1] = { type: 'text', value: prev.value + seg.value };
        } else {
          merged.push(seg);
        }
      }
      if (merged.length === 0) merged.push({ type: 'text', value: '' });
      setSegments(merged);
      onChange(serializeSegments(merged));
    },
    [segments, onChange]
  );

  return (
    <div className={styles.editor} data-testid="rich-text-editor">
      {segments.map((segment, i) => {
        if (segment.type === 'text') {
          return (
            <textarea
              key={`text-${i}`}
              className={styles.textArea}
              value={segment.value}
              onChange={(e) => handleTextChange(i, e.target.value)}
              placeholder={i === 0 ? placeholder : undefined}
              disabled={disabled}
              rows={1}
            />
          );
        }

        const isImage = segment.mimeType.startsWith('image/');
        return (
          <div key={`att-${segment.id}`} className={styles.attachmentNode}>
            {isImage ? (
              <AttachmentPreview
                attachmentId={segment.id}
                fileName={segment.fileName}
                // El editor lee por `fileId` porque el vínculo todavía no existe; el feed
                // lee por `attachments.id` porque ya existe. Confundirlos es silencioso:
                // devuelve el archivo equivocado o un 404, según qué exista con ese número.
                previewUrl={attachmentsApi.getFilePreviewUrl(segment.id)}
                mimeType={segment.mimeType}
                fileSize={segment.fileSize}
                onRemove={() => handleRemove(segment.id)}
              />
            ) : (
              <AttachmentDownload
                attachmentId={segment.id}
                resource="file"
                fileName={segment.fileName}
                fileSize={segment.fileSize}
                onRemove={() => handleRemove(segment.id)}
              />
            )}
          </div>
        );
      })}
      {uploading && (
        <div
          className={styles.uploadProgress}
          role="progressbar"
          aria-valuenow={uploadProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Subiendo ${uploadingFileName}`}
        >
          <span className={styles.progressLabel}>
            {`Subiendo ${uploadingFileName}... ${uploadProgress}%`}
          </span>
          <span className={styles.progressTrack}>
            <span className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}
