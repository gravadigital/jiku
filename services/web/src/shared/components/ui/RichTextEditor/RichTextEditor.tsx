'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AttachmentPlaceholder } from '@/features/attachments/components/MarkdownViewer/AttachmentPlaceholder';
import { AttachmentPreview } from '../AttachmentPreview/AttachmentPreview';
import { AttachmentSkeleton } from '../AttachmentSkeleton/AttachmentSkeleton';
import styles from './RichTextEditor.module.scss';
import type { AttachmentResource } from '@/features/attachments/types/attachment.types';

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

export interface AttachmentMeta {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  /**
   * Espacio de identificadores de `id`. `attachment` (default) es un vínculo
   * ya guardado; `file` es un archivo recién subido, sin vínculo todavía.
   */
  resource?: AttachmentResource;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  attachmentMeta?: AttachmentMeta[];
  placeholder?: string;
  disabled?: boolean;
  uploading?: boolean;
  uploadingMimeType?: string;
}

type EditorSegment =
  | { type: 'text'; value: string }
  | {
      type: 'attachment';
      id: number;
      resource: AttachmentResource;
      fileName: string;
      mimeType: string;
      fileSize?: number;
    };

/**
 * Dos prefijos, dos espacios de identificadores: `attach:N` es id de vínculo
 * (markdown ya guardado) y `file:N` es id de `files` (archivo recién subido,
 * todavía sin vincular). No se pueden mezclar: resolver uno contra la ruta del
 * otro daría un 404 o el preview de otro adjunto.
 */
const PLACEHOLDER_REGEX = /(!?\[(attach|file):(\d+)\])/g;

function metaKey(resource: AttachmentResource, id: number): string {
  return `${resource}:${id}`;
}

function parseToSegments(content: string, meta: AttachmentMeta[]): EditorSegment[] {
  const metaMap = new Map(meta.map((m) => [metaKey(m.resource ?? 'attachment', m.id), m]));
  const segments: EditorSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    const isImage = match[1].startsWith('!');
    const resource: AttachmentResource = match[2] === 'file' ? 'file' : 'attachment';
    const id = parseInt(match[3], 10);
    const m = metaMap.get(metaKey(resource, id));
    segments.push({
      type: 'attachment',
      id,
      resource,
      fileName: m?.fileName ?? '',
      mimeType: m?.mimeType ?? (isImage ? 'image/jpeg' : 'application/octet-stream'),
      fileSize: m?.fileSize,
    });
    lastIndex = match.index + match[0].length;
  }
  segments.push({ type: 'text', value: content.slice(lastIndex) });
  return segments;
}

function serializeSegments(segments: EditorSegment[]): string {
  return segments
    .map((s) => {
      if (s.type === 'text') return s.value;
      const prefix = s.resource === 'file' ? 'file' : 'attach';
      return s.mimeType.startsWith('image/') ? `![${prefix}:${s.id}]` : `[${prefix}:${s.id}]`;
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
  uploadingMimeType = '',
}: RichTextEditorProps) {
  const [segments, setSegments] = useState<EditorSegment[]>(() =>
    parseToSegments(value, attachmentMeta)
  );
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  useEffect(() => {
    setSegments(parseToSegments(value, attachmentMeta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    textareaRefs.current.forEach((el) => autoResize(el));
  }, [segments]);

  const handleTextChange = useCallback(
    (index: number, newText: string, el: HTMLTextAreaElement) => {
      autoResize(el);
      const updated = segments.map((s, i) =>
        i === index && s.type === 'text' ? { ...s, value: newText } : s
      );
      setSegments(updated);
      onChange(serializeSegments(updated));
    },
    [segments, onChange]
  );

  /**
   * El contenido se parte en un `<textarea>` por segmento de texto, y cada uno
   * se auto-dimensiona a lo que tiene: entre ellos quedan los adjuntos, el
   * `gap` del contenedor y, debajo del último, todo el alto sobrante del área
   * de scroll. Un click ahí no cae sobre ningún campo y no enfocaba nada, así
   * que el editor parecía de solo lectura salvo que se acertara al texto.
   *
   * Se resuelve en `mousedown` y no en `click` para ganarle al foco nativo, y
   * se hace `preventDefault()` para que el navegador no vuelva a moverlo
   * después. Un click sobre un textarea o sobre un adjunto no se toca: ahí el
   * comportamiento nativo ya es el correcto.
   */
  const handleContainerMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.target !== event.currentTarget) return;

      const textareas = Array.from(textareaRefs.current.entries())
        .sort(([a], [b]) => a - b)
        .map(([, el]) => el);
      if (textareas.length === 0) return;

      const { clientY } = event;
      // Distancia vertical al campo: 0 si el punto cae dentro de su franja.
      const target = textareas.reduce((closest, el) => {
        const rect = el.getBoundingClientRect();
        const distance = Math.max(rect.top - clientY, clientY - rect.bottom, 0);
        const closestRect = closest.getBoundingClientRect();
        const closestDistance = Math.max(
          closestRect.top - clientY,
          clientY - closestRect.bottom,
          0
        );
        return distance < closestDistance ? el : closest;
      }, textareas[0]);

      event.preventDefault();
      target.focus();
      const end = target.value.length;
      target.setSelectionRange(end, end);
    },
    [disabled]
  );

  const handleRemove = useCallback(
    (id: number, resource: AttachmentResource) => {
      const filtered = segments.filter(
        (s) => !(s.type === 'attachment' && s.id === id && s.resource === resource)
      );
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
    <div className={styles.editor} onMouseDown={handleContainerMouseDown}>
      {segments.map((segment, i) => {
        if (segment.type === 'text') {
          return (
            <textarea
              key={`text-${i}`}
              ref={(el) => {
                if (el) {
                  textareaRefs.current.set(i, el);
                  autoResize(el);
                } else {
                  textareaRefs.current.delete(i);
                }
              }}
              className={styles.textArea}
              value={segment.value}
              onChange={(e) => handleTextChange(i, e.target.value, e.target)}
              placeholder={i === 0 ? placeholder : undefined}
              disabled={disabled}
              rows={1}
            />
          );
        }

        const isImage = segment.mimeType.startsWith('image/');
        return (
          <div key={`att-${segment.resource}-${segment.id}`} className={styles.attachmentNode}>
            {isImage ? (
              <AttachmentPreview
                attachmentId={segment.id}
                resource={segment.resource}
                fileName={segment.fileName}
                mimeType={segment.mimeType}
                fileSize={segment.fileSize}
                onRemove={() => handleRemove(segment.id, segment.resource)}
              />
            ) : (
              <AttachmentPlaceholder
                attachmentId={segment.id}
                resource={segment.resource}
                fileName={segment.fileName}
                onRemove={() => handleRemove(segment.id, segment.resource)}
              />
            )}
          </div>
        );
      })}
      {uploading && (
        <div className={styles.attachmentNode}>
          <AttachmentSkeleton isImage={uploadingMimeType.startsWith('image/')} />
        </div>
      )}
    </div>
  );
}
