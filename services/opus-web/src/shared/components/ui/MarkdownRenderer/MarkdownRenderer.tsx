import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import styles from './MarkdownRenderer.module.scss';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={`${styles.markdown} ${className ?? ''}`} data-testid="markdown-content">
      <Markdown
        components={{
          a: ({ href, children }: { href?: string; children?: ReactNode }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
