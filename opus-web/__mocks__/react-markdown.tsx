import React from 'react';

type HeadingComponent = (props: { children?: React.ReactNode }) => React.JSX.Element;

interface MarkdownProps {
  children?: string;
  /** Descarta el HTML crudo (como `skipHtml` de react-markdown). Sin esto, queda como texto. */
  skipHtml?: boolean;
  /** Se aplica a `href` y `src`, como en react-markdown. */
  urlTransform?: (url: string, key?: string) => string | null | undefined;
  components?: {
    a?: (props: { href?: string; children?: React.ReactNode }) => React.JSX.Element;
    img?: (props: { src?: string; alt?: string }) => React.JSX.Element;
    h1?: HeadingComponent;
    h2?: HeadingComponent;
    h3?: HeadingComponent;
    h4?: HeadingComponent;
    h5?: HeadingComponent;
    h6?: HeadingComponent;
  };
}

function parseMarkdown(
  rawContent: string,
  components?: MarkdownProps['components'],
  options: Pick<MarkdownProps, 'skipHtml' | 'urlTransform'> = {}
): React.ReactNode {
  if (!rawContent) return null;
  const content = options.skipHtml ? rawContent.replace(/<[^>]*>/g, '') : rawContent;
  const transform = (url: string, key: string): string =>
    options.urlTransform ? (options.urlTransform(url, key) ?? '') : url;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let codeBlock = false;
  let codeContent: string[] = [];

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag key={elements.length}>
          {listItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  const flushCodeBlock = () => {
    if (codeContent.length > 0) {
      elements.push(
        <pre key={elements.length}>
          <code>{codeContent.join('\n')}</code>
        </pre>
      );
      codeContent = [];
    }
  };

  const parseInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(remaining.slice(0, boldMatch.index));
        }
        parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // Italic
      const italicMatch = remaining.match(/\*(.+?)\*/);
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) {
          parts.push(remaining.slice(0, italicMatch.index));
        }
        parts.push(<em key={key++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
        continue;
      }

      // Inline code
      const codeMatch = remaining.match(/`([^`]+)`/);
      if (codeMatch && codeMatch.index !== undefined) {
        if (codeMatch.index > 0) {
          parts.push(remaining.slice(0, codeMatch.index));
        }
        parts.push(<code key={key++}>{codeMatch[1]}</code>);
        remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
        continue;
      }

      // Images (antes que los links: `![alt](src)` también matchea como link)
      const imageMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      const linkCandidate = remaining.match(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/);
      if (
        imageMatch &&
        imageMatch.index !== undefined &&
        (!linkCandidate || (linkCandidate.index ?? 0) > imageMatch.index)
      ) {
        if (imageMatch.index > 0) {
          parts.push(remaining.slice(0, imageMatch.index));
        }
        const src = transform(imageMatch[2], 'src');
        const imgProps = { src, alt: imageMatch[1] };
        if (components?.img) {
          parts.push(<React.Fragment key={key++}>{components.img(imgProps)}</React.Fragment>);
        } else {
          // eslint-disable-next-line @next/next/no-img-element
          parts.push(<img key={key++} src={src || undefined} alt={imageMatch[1]} />);
        }
        remaining = remaining.slice(imageMatch.index + imageMatch[0].length);
        continue;
      }

      // Links
      const linkMatch = linkCandidate;
      if (linkMatch && linkMatch.index !== undefined) {
        if (linkMatch.index > 0) {
          parts.push(remaining.slice(0, linkMatch.index));
        }
        const href = transform(linkMatch[2], 'href');
        const linkProps = { href, children: linkMatch[1] };
        if (components?.a) {
          parts.push(<React.Fragment key={key++}>{components.a(linkProps)}</React.Fragment>);
        } else {
          parts.push(
            <a key={key++} href={href}>
              {linkMatch[1]}
            </a>
          );
        }
        remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
        continue;
      }

      parts.push(remaining);
      break;
    }

    return parts.length === 1 ? parts[0] : parts;
  };

  for (const line of lines) {
    // Code block
    if (line.startsWith('```')) {
      if (codeBlock) {
        flushCodeBlock();
        codeBlock = false;
      } else {
        flushList();
        codeBlock = true;
      }
      continue;
    }

    if (codeBlock) {
      codeContent.push(line);
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const headingOverride = components?.[`h${level}` as 'h1'];
      if (headingOverride) {
        elements.push(
          <React.Fragment key={elements.length}>
            {headingOverride({ children: parseInline(headerMatch[2]) })}
          </React.Fragment>
        );
        continue;
      }
      const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;
      elements.push(<HeadingTag key={elements.length}>{parseInline(headerMatch[2])}</HeadingTag>);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(parseInline(ulMatch[1]));
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(parseInline(olMatch[1]));
      continue;
    }

    // Regular paragraph
    if (line.trim()) {
      flushList();
      elements.push(<p key={elements.length}>{parseInline(line)}</p>);
    }
  }

  flushList();
  flushCodeBlock();

  return elements;
}

function Markdown({ children, components, skipHtml, urlTransform }: MarkdownProps) {
  return <>{parseMarkdown(children ?? '', components, { skipHtml, urlTransform })}</>;
}

export default Markdown;
