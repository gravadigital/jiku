import React from 'react';
import { Badge } from '@/shared/components/ui';
import styles from './TopicPills.module.scss';

interface TopicPillsProps {
  readonly topics?: readonly string[];
  readonly max?: number;
  /** Texto cuando no hay temas (en la columna "Temas"); sin él, no se pinta nada. */
  readonly emptyLabel?: string;
}

export function TopicPills({ topics, max = 3, emptyLabel }: TopicPillsProps) {
  if (!topics || topics.length === 0) return emptyLabel ? <>{emptyLabel}</> : null;
  const extra = topics.length - max;
  return (
    <span className={styles.pills}>
      {topics.slice(0, max).map((topic) => (
        <Badge key={topic} variant="outline" family="neutral" label={topic} />
      ))}
      {extra > 0 && <span className={styles.more}>{`+${extra}`}</span>}
    </span>
  );
}
