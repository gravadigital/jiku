'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AttachmentPlaceholder } from '@/features/attachments/components/MarkdownViewer/AttachmentPlaceholder';
import { AttachmentPreview } from '../AttachmentPreview/AttachmentPreview';
import { AttachmentSkeleton } from '../AttachmentSkeleton/AttachmentSkeleton';
import styles from './RichTextEditor.module.scss';

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
  | { type: 'attachment'; id: number; fileName: string; mimeType: string; fileSize?: number };

const PLACEHOLDER_REGEX = /(!?\[attach:(\d+)\])/g;

function parseToSegments(content: string, meta: AttachmentMeta[]): EditorSegment[] {
  const metaMap = new Map(meta.map((m) => [m.id, m]));
  const segments: EditorSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
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
  segments.push({ type: 'text', value: content.slice(lastIndex) });
  return segments;
}

function serializeSegments(segments: EditorSegment[]): string {
  return segments
    .map((s) => {
      if (s.type === 'text') return s.value;
      return s.mimeType.startsWith('image/') ? `![attach:${s.id}]` : `[attach:${s.id}]`;
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

  const handleRemove = useCallback(
    (id: number) => {
      const filtered = segments.filter((s) => !(s.type === 'attachment' && s.id === id));
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
    <div className={styles.editor}>
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
          <div key={`att-${segment.id}`} className={styles.attachmentNode}>
            {isImage ? (
              <AttachmentPreview
                attachmentId={segment.id}
                fileName={segment.fileName}
                mimeType={segment.mimeType}
                fileSize={segment.fileSize}
                onRemove={() => handleRemove(segment.id)}
              />
            ) : (
              <AttachmentPlaceholder
                attachmentId={segment.id}
                fileName={segment.fileName}
                onRemove={() => handleRemove(segment.id)}
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
