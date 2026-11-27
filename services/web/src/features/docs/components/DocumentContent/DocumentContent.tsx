'use client';

import { useMemo } from 'react';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { extractHeadings, type DocHeading } from '../../utils/documentHeadings';
import { stripFrontmatter } from '../../utils/frontmatter';

interface DocumentContentProps {
  readonly content: string;
}

/** Encabezados del cuerpo sin frontmatter: las líneas coinciden con las del render. */
export const useDocumentHeadings = (content: string): DocHeading[] =>
  useMemo(() => extractHeadings(stripFrontmatter(content)), [content]);

export function DocumentContent({ content }: DocumentContentProps) {
  const body = useMemo(() => stripFrontmatter(content), [content]);
  const headingIds = useMemo(
    () => new Map(extractHeadings(body).map((h) => [h.line, h.id])),
    [body]
  );
  return <MarkdownViewer mode="document" content={body} headingIds={headingIds} />;
}
