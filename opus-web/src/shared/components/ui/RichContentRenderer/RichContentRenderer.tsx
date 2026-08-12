'use client';

import { useEffect, useState } from 'react';
import { AttachmentPreview } from '../AttachmentPreview/AttachmentPreview';
import { AttachmentDownload } from '../AttachmentDownload/AttachmentDownload';
import { AttachmentSkeleton } from '../AttachmentSkeleton/AttachmentSkeleton';
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer';
import styles from './RichContentRenderer.module.scss';

interface RichContentRendererProps {
  content: string;
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'image'; id: number }
  | { type: 'file'; id: number }
  | { type: 'image-named'; id: number; fileName: string }
  | { type: 'file-named'; id: number; fileName: string };

// Matches ![attach:N] and [attach:N] (opus-web format)
const PLACEHOLDER_REGEX = /(!?\[attach:(\d+)\])/g;
// Matches !?[fileName](/api/attachments/N/preview) (gestor interno format, ! prefix = image)
const GESTOR_LINK_REGEX = /(!?)\[([^\]]+)\]\(\/api\/attachments\/(\d+)\/preview\)/g;

function parseContent(content: string): Segment[] {
  type RawMatch = { index: number; length: number; segment: Segment };
  const matches: RawMatch[] = [];

  PLACEHOLDER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    const isImage = match[1].startsWith('!');
    const id = parseInt(match[2], 10);
    matches.push({
      index: match.index,
      length: match[0].length,
      segment: isImage ? { type: 'image', id } : { type: 'file', id },
    });
  }

  GESTOR_LINK_REGEX.lastIndex = 0;
  while ((match = GESTOR_LINK_REGEX.exec(content)) !== null) {
    const isImage = match[1] === '!';
    const fileName = match[2];
    const id = parseInt(match[3], 10);
    matches.push({
      index: match.index,
      length: match[0].length,
      segment: isImage
        ? { type: 'image-named', id, fileName }
        : { type: 'file-named', id, fileName },
    });
  }

  matches.sort((a, b) => a.index - b.index);

  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const m of matches) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, m.index) });
    }
    segments.push(m.segment);
    lastIndex = m.index + m.length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return segments;
}

function extractFileName(disposition: string | null): string {
  if (!disposition) return '';
  const match =
    disposition.match(/filename\*=UTF-8''([^;]+)/) ??
    disposition.match(/filename="([^"]+)"/) ??
    disposition.match(/filename=([^;]+)/);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

interface AttachmentInfo {
  fileName: string;
  fileSize?: number;
  loading: boolean;
}

function useAttachmentInfo(id: number): AttachmentInfo {
  const [info, setInfo] = useState<AttachmentInfo>({ fileName: '', loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/attachments/${id}/preview`, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return;
        const fileName = extractFileName(res.headers.get('Content-Disposition'));
        const contentLength = res.headers.get('Content-Length');
        const fileSize = contentLength ? parseInt(contentLength, 10) : undefined;
        setInfo({ fileName, fileSize, loading: false });
      })
      .catch(() => {
        setInfo({ fileName: '', loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return info;
}

function FileSegment({ id }: { id: number }) {
  const { fileName, fileSize, loading } = useAttachmentInfo(id);
  if (loading) return <AttachmentSkeleton isImage={false} />;
  return <AttachmentDownload attachmentId={id} fileName={fileName} fileSize={fileSize} />;
}

function useFileSize(id: number): number | undefined {
  const [fileSize, setFileSize] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/attachments/${id}/preview`, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return;
        const contentLength = res.headers.get('Content-Length');
        if (contentLength) setFileSize(parseInt(contentLength, 10));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  return fileSize;
}

function FileNamedSegment({ id, fileName }: { id: number; fileName: string }) {
  const fileSize = useFileSize(id);
  return <AttachmentDownload attachmentId={id} fileName={fileName} fileSize={fileSize} />;
}

function ImageNamedSegment({ id, fileName }: { id: number; fileName: string }) {
  const previewUrl = `/api/attachments/${id}/preview`;
  const fileSize = useFileSize(id);
  return (
    <AttachmentPreview
      attachmentId={id}
      fileName={fileName}
      previewUrl={previewUrl}
      mimeType="image/jpeg"
      fileSize={fileSize}
    />
  );
}

function ImageSegment({ id }: { id: number }) {
  const { fileName, fileSize, loading } = useAttachmentInfo(id);
  const previewUrl = `/api/attachments/${id}/preview`;
  if (loading) return <AttachmentSkeleton isImage />;
  return (
    <AttachmentPreview
      attachmentId={id}
      fileName={fileName}
      previewUrl={previewUrl}
      mimeType="image/jpeg"
      fileSize={fileSize}
    />
  );
}

export function RichContentRenderer({ content }: RichContentRendererProps) {
  if (!content) {
    return <div data-testid="markdown-content" />;
  }

  const segments = parseContent(content);
  const hasPlaceholders = segments.some((s) => s.type !== 'text');

  if (!hasPlaceholders) {
    return <MarkdownRenderer content={content} />;
  }

  return (
    <div className={styles.root}>
      {segments.map((segment, i) => {
        if (segment.type === 'text') {
          if (!segment.value.trim()) return null;
          return <MarkdownRenderer key={i} content={segment.value} />;
        }
        if (segment.type === 'image') {
          return <ImageSegment key={`${segment.id}-${i}`} id={segment.id} />;
        }
        if (segment.type === 'image-named') {
          return (
            <ImageNamedSegment
              key={`${segment.id}-${i}`}
              id={segment.id}
              fileName={segment.fileName}
            />
          );
        }
        if (segment.type === 'file-named') {
          return (
            <FileNamedSegment
              key={`${segment.id}-${i}`}
              id={segment.id}
              fileName={segment.fileName}
            />
          );
        }
        return <FileSegment key={`${segment.id}-${i}`} id={segment.id} />;
      })}
    </div>
  );
}
