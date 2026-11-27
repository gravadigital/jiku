'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Spinner } from '@/shared/components/ui';
import styles from './KanbanColumn.module.scss';

const DOT_CLASSES: Record<string, string> = {
  analisis: styles.dotAnalisis,
  planificacion: styles.dotPlanificacion,
  en_cola: styles.dotEnCola,
  desarrollo: styles.dotDesarrollo,
  revision: styles.dotRevision,
  resuelto: styles.dotResuelto,
  cancelado: styles.dotCancelado,
};

const COUNT_CLASSES: Record<string, string> = {
  analisis: styles.countAnalisis,
  planificacion: styles.countPlanificacion,
  en_cola: styles.countEnCola,
  desarrollo: styles.countDesarrollo,
  revision: styles.countRevision,
  resuelto: styles.countResuelto,
  cancelado: styles.countCancelado,
};

interface KanbanColumnProps {
  title: string;
  count: number;
  columnId: string;
  children: React.ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  defaultCollapsed?: boolean;
}

export function KanbanColumn({
  title,
  count,
  columnId,
  children,
  onLoadMore,
  hasMore,
  isLoadingMore,
  defaultCollapsed = false,
}: KanbanColumnProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const dotClass = DOT_CLASSES[columnId] ?? styles.dotBacklog;
  const countClass = COUNT_CLASSES[columnId] ?? styles.countBacklog;

  if (collapsed) {
    return (
      <section className={`${styles.column} ${styles.columnCollapsed}`}>
        <button className={styles.collapsedHeader} onClick={() => setCollapsed(false)}>
          <ChevronLeft size={14} className={styles.chevronCollapsed} />
          <span className={`${styles.dot} ${dotClass}`} />
          <span className={styles.collapsedTitle}>{title}</span>
          <span className={`${styles.count} ${countClass}`}>{count}</span>
        </button>
      </section>
    );
  }

  return (
    <section className={styles.column}>
      <header
        className={styles.header}
        onClick={() => setCollapsed(true)}
        style={{ cursor: 'pointer' }}
      >
        <span className={`${styles.dot} ${dotClass}`} />
        <h2 className={styles.title}>{title}</h2>
        <span className={`${styles.count} ${countClass}`}>{count}</span>
        <ChevronLeft size={14} className={styles.chevronExpanded} />
      </header>
      <div className={styles.cards}>
        {children}
        {hasMore && (
          <button
            className={styles.loadMoreButton}
            onClick={onLoadMore}
            disabled={isLoadingMore}
            type="button"
          >
            {isLoadingMore ? (
              <>
                <Spinner size="sm" />
                <span>Cargando...</span>
              </>
            ) : (
              'Ver más'
            )}
          </button>
        )}
      </div>
    </section>
  );
}
