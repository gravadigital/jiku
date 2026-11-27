import Link from 'next/link';
import { Badge, Card, type BadgeFamily } from '@/shared/components/ui';
import styles from './ClientCard.module.scss';
import type { Client, ClientStatus } from '@/features/clients/types/client.types';
import type { SyntheticEvent } from 'react';

interface ClientCardProps {
  readonly client: Client;
  readonly status: ClientStatus;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}

// Lapiz de 15px con el trazo de la iconografia del manual (1,6px, uniones redondeadas).
function PencilIcon() {
  return (
    <svg
      className={styles.editIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10v3Z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}

export function ClientCard({ client, status, expanded, onToggle }: ClientCardProps) {
  const statusLabel = status === 'activo' ? 'Activo' : 'Inactivo';
  // `STATE_TO_FAMILY` mapea estados de requisito (planificacion, en_cola, ...), otro
  // dominio: el actor sólo distingue activo/inactivo. Mapeo propio a propósito.
  const statusFamily: BadgeFamily = status === 'activo' ? 'resolved' : 'neutral';

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open;
    if (isOpen !== expanded) {
      onToggle();
    }
  };

  return (
    <Card
      variant="panel"
      headingLevel="h3"
      header={
        <div className={styles.row}>
          <details className={styles.disclosure} open={expanded} onToggle={handleToggle}>
            <summary className={styles.toggle}>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
              <Badge variant="state" family={statusFamily} label={statusLabel} />
              <span className={styles.name}>{client.name}</span>
            </summary>
          </details>
          {/* Boton de icono de 30x30 con borde de 1,5px verde agua y lapiz de 15px
              (handoff § 8). Antes era un boton de texto "Editar" de 70x40. El nombre
              accesible lo da el aria-label, que nombra al actor. */}
          <Link
            className={styles.editButton}
            href={`/clients/edit/${client.id}`}
            aria-label={`Editar ${client.name}`}
          >
            <PencilIcon />
          </Link>
        </div>
      }
    />
  );
}
