import Link from 'next/link';
import { cn } from '@/shared/utils/cn';
import styles from './ClientCard.module.scss';
import type { Client, ClientStatus } from '@/features/clients/types/client.types';

interface ClientCardProps {
  readonly client: Client;
  readonly status: ClientStatus;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}

function ChevronIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={expanded ? styles.chevronUp : ''}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function ClientCard({ client, status, expanded, onToggle }: ClientCardProps) {
  return (
    <div className={styles.group}>
      <button type="button" className={cn(styles.row, styles.level1)} onClick={onToggle}>
        <span className={styles.chevron}>
          <ChevronIcon expanded={expanded} />
        </span>
        <span className={cn(styles.statusBadge, styles[status])}>
          {status === 'activo' ? 'Activo' : 'Inactivo'}
        </span>
        <span className={styles.name}>{client.name}</span>
        <Link
          href={`/clients/edit/${client.id}`}
          className={styles.editButton}
          onClick={(e) => e.stopPropagation()}
          title="Editar actor"
        >
          <EditIcon />
        </Link>
      </button>
    </div>
  );
}
