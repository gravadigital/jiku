import React from 'react';

interface MarkdownProps {
  children?: string;
  components?: {
    a?: (props: { href?: string; children?: React.ReactNode }) => React.JSX.Element;
  };
}

function parseMarkdown(content: string, components?: MarkdownProps['components']): React.ReactNode {
  if (!content) return null;

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

      // Links
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch && linkMatch.index !== undefined) {
        if (linkMatch.index > 0) {
          parts.push(remaining.slice(0, linkMatch.index));
        }
        const linkProps = { href: linkMatch[2], children: linkMatch[1] };
        if (components?.a) {
          parts.push(<React.Fragment key={key++}>{components.a(linkProps)}</React.Fragment>);
        } else {
          parts.push(
            <a key={key++} href={linkMatch[2]}>
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

function Markdown({ children, components }: MarkdownProps) {
  return <>{parseMarkdown(children ?? '', components)}</>;
}

export default Markdown;
