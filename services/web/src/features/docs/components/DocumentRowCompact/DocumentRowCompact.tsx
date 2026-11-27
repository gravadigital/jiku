import React from 'react';
import Link from 'next/link';
import { formatDay } from '../../utils/dates';
import { TopicPills } from '../TopicPills';
import styles from './DocumentRowCompact.module.scss';
import type { DocsDocument } from '../../types/docs.types';

export const INDIRECT_LABEL = 'vinculado, sin proyecto propio';

interface DocumentRowCompactProps {
  readonly doc: Pick<DocsDocument, 'id' | 'title' | 'updatedAt' | 'topics' | 'projectMatch'>;
  /** Solo la card de proyecto: el documento llega por un requisito o tarea del proyecto. */
  readonly showIndirect?: boolean;
}

export function DocumentRowCompact({ doc, showIndirect = false }: DocumentRowCompactProps) {
  const indirect = showIndirect && doc.projectMatch === 'indirect';
  return (
    <li className={styles.row}>
      <span className={styles.icon} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" focusable="false">
          <path
            d="M4 1.5h5l3.5 3.5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11.5a1 1 0 0 1 1-1Zm5 0V5h3.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className={styles.text}>
        <Link href={`/docs/${doc.id}`} className={styles.link}>
          {doc.title}
        </Link>
        <span className={styles.meta}>
          <TopicPills topics={doc.topics} emptyLabel="Sin tema" />
          {indirect && ` · ${INDIRECT_LABEL}`}
        </span>
      </div>
      <span className={styles.date}>{formatDay(doc.updatedAt)}</span>
    </li>
  );
}
