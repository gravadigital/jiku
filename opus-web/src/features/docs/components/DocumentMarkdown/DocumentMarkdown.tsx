import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import { docsUrlTransform } from '../../utils/docsUrlTransform';
import { stripFrontmatter } from '../../utils/frontmatter';
import styles from './DocumentMarkdown.module.scss';

interface DocumentMarkdownProps {
  content: string;
}

type Children = { children?: ReactNode };

/**
 * Visor markdown de solo lectura. Sin `rehype-raw` ni plugins: el HTML crudo se descarta
 * (`skipHtml`) y `urlTransform` deja pasar solo http(s), mailto y adjuntos. Los títulos se
 * desplazan un nivel para no competir con el h1 de la pantalla.
 */
export function DocumentMarkdown({ content }: DocumentMarkdownProps) {
  return (
    <div className={styles.markdown} data-testid="document-content">
      <Markdown
        skipHtml
        urlTransform={docsUrlTransform}
        components={{
          h1: ({ children }: Children) => <h2>{children}</h2>,
          h2: ({ children }: Children) => <h3>{children}</h3>,
          h3: ({ children }: Children) => <h4>{children}</h4>,
          h4: ({ children }: Children) => <h5>{children}</h5>,
          h5: ({ children }: Children) => <h6>{children}</h6>,
          h6: ({ children }: Children) => <h6>{children}</h6>,
          a: ({ href, children }: { href?: string; children?: ReactNode }) => (
            <a href={href || undefined} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }: { src?: string | Blob; alt?: string }) =>
            typeof src === 'string' && src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ''} loading="lazy" className={styles.image} />
            ) : (
              <></>
            ),
        }}
      >
        {stripFrontmatter(content)}
      </Markdown>
    </div>
  );
}
