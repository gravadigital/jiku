import styles from './RequirementCard.module.scss';

interface RequirementCardProps {
  id: number;
  title: string;
  state: string;
  description?: string;
  createdAt: string;
  onClick?: () => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const VALID_STATES = new Set([
  'analisis',
  'planificacion',
  'en_cola',
  'desarrollo',
  'revision',
  'resuelto',
  'cancelado',
]);

function getStateDataAttribute(state: string): string {
  return VALID_STATES.has(state) ? state : 'analisis';
}

export function RequirementCard({ id, title, state, createdAt, onClick }: RequirementCardProps) {
  function handleKeyDown(event: React.KeyboardEvent) {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  }

  const stateAttr = getStateDataAttribute(state);

  return (
    <article
      className={styles.card}
      data-state={stateAttr}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Ver requisito ${title}` : undefined}
    >
      <h3 className={styles.title}>{title}</h3>
      <footer className={styles.footer}>
        <span className={styles.id}>#{id}</span>
        <span className={styles.date}>
          <svg
            className={styles.calendarIcon}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {formatDate(createdAt)}
        </span>
      </footer>
    </article>
  );
}
