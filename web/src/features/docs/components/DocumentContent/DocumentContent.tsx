'use client';

import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';

interface DocumentContentProps {
  readonly content: string;
}

export function DocumentContent({ content }: DocumentContentProps) {
  return <MarkdownViewer mode="document" content={content} />;
}
