'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/shared/components/ui';
import styles from './DocumentToc.module.scss';
import type { DocHeading } from '../../utils/documentHeadings';

interface DocumentTocProps {
  readonly headings: readonly DocHeading[];
}

/** "En este documento": un enlace por encabezado de nivel 1 y 2, con el visible marcado. */
export function DocumentToc({ headings }: DocumentTocProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0 || typeof IntersectionObserver === 'undefined') return;
    // El encabezado que entra por la parte alta manda: se ignora el 70% inferior de la ventana.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '0px 0px -70% 0px' }
    );
    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <Card variant="panel" title="En este documento" headingLevel="h2">
      <nav aria-label="En este documento">
        <ol className={styles.list}>
          {headings.map((heading) => (
            <li key={heading.id} className={heading.level === 2 ? styles.nested : undefined}>
              <a
                href={`#${heading.id}`}
                className={styles.link}
                aria-current={activeId === heading.id ? 'location' : undefined}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </Card>
  );
}
