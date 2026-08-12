'use client';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { parseMarkdownWithPlaceholders } from '../../utils/markdownParser';
import { AttachmentImagePreview } from './AttachmentImagePreview';
import { AttachmentPlaceholder } from './AttachmentPlaceholder';
import styles from './MarkdownViewer.module.scss';

interface MarkdownViewerProps {
  readonly content: string;
}

function urlTransform(url: string): string {
  if (url.startsWith('placeholder:') || url.startsWith('fileplaceholder:')) {
    return url;
  }
  const safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i;
  try {
    const parsed = new URL(url);
    if (safeProtocol.test(parsed.protocol.replace(/:$/, ''))) {
      return url;
    }
  } catch {
    if (!url.startsWith('javascript:')) {
      return url;
    }
  }
  return '';
}

function childrenToText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => (typeof child === 'string' ? child : ''))
    .join('');
}

const NON_BREAKING_SPACE = String.fromCharCode(160);

// CommonMark colapsa cualquier cantidad de lineas en blanco consecutivas a una sola
// separacion de parrafo, perdiendo cuantas lineas en blanco dejo el usuario en el textarea.
// Cada linea en blanco se reemplaza por una linea que contiene solo un espacio no separable,
// rodeada de saltos dobles — asi CommonMark la trata como su propio parrafo (uno por cada
// linea en blanco original), en vez de colapsarla. El componente `p` custom de abajo detecta
// ese parrafo (contenido == NBSP) y lo renderiza como un elemento espaciador dedicado, no
// como texto. Se aplica ANTES de parseMarkdownWithPlaceholders porque ese parser normaliza
// saltos de 3 o mas a 2 internamente — si se aplicara despues, ya habria perdido lineas en
// blanco consecutivas mas alla de la primera.
function preserveBlankLines(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    if (/^[ \t]*$/.test(line)) {
      result.push('', NON_BREAKING_SPACE, '');
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

function isBlankLineMarker(children: React.ReactNode): boolean {
  const text = childrenToText(children);
  return text === NON_BREAKING_SPACE;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  const { processedContent } = useMemo(
    () => parseMarkdownWithPlaceholders(preserveBlankLines(content)),
    [content]
  );

  return (
    <div className={styles.viewer}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={urlTransform}
        components={{
          p: ({ children }) => {
            if (isBlankLineMarker(children)) {
              return (
                <span className={styles.blankLine} data-testid="blank-line" aria-hidden="true">
                  {NON_BREAKING_SPACE}
                </span>
              );
            }
            return <p>{children}</p>;
          },
          img: ({ src, alt }) => {
            const srcStr = typeof src === 'string' ? src : undefined;
            if (srcStr?.startsWith('placeholder:')) {
              const attachmentId = parseInt(srcStr.replace('placeholder:', ''), 10);
              return (
                <AttachmentImagePreview attachmentId={attachmentId} fileName={alt || undefined} />
              );
            }
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={srcStr} alt={alt ?? ''} />;
          },
          a: ({ href, children }) => {
            if (typeof href === 'string' && href.startsWith('fileplaceholder:')) {
              const attachmentId = parseInt(href.replace('fileplaceholder:', ''), 10);
              const label = childrenToText(children);
              return (
                <AttachmentPlaceholder attachmentId={attachmentId} fileName={label || undefined} />
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          html: () => null,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
