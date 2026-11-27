import { Spinner } from '@/shared/components/ui';
import styles from './StateAccordion.module.scss';

interface StateAccordionProps {
  state: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

function getStateDataAttribute(state: string): string {
  const stateMap: Record<string, string> = {
    Backlog: 'backlog',
    Activo: 'active',
    'En revisión': 'review',
    Finalizado: 'done',
  };
  return stateMap[state] ?? 'backlog';
}

export function StateAccordion({
  state,
  count,
  isExpanded,
  onToggle,
  children,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: StateAccordionProps) {
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  }

  function handleLoadMoreClick(event: React.MouseEvent) {
    event.stopPropagation();
    onLoadMore?.();
  }

  const stateAttr = getStateDataAttribute(state);

  return (
    <section className={styles.accordion} data-state={stateAttr}>
      <header
        className={styles.header}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${state}, ${count} objetivos`}
      >
        <span className={styles.stateName}>{state}</span>
        <span className={styles.badge} data-state={stateAttr}>
          {count}
        </span>
        <svg
          className={styles.icon}
          data-expanded={isExpanded}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </header>
      <div className={styles.content} data-expanded={isExpanded}>
        {isExpanded && (
          <>
            {children}
            {hasMore && (
              <button
                className={styles.loadMoreButton}
                onClick={handleLoadMoreClick}
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
          </>
        )}
      </div>
    </section>
  );
}
