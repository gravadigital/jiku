import { Badge, Button, Card, type BadgeFamily } from '@/shared/components/ui';
import styles from './ClientCard.module.scss';
import type { Client, ClientStatus } from '@/features/clients/types/client.types';
import type { SyntheticEvent } from 'react';

interface ClientCardProps {
  readonly client: Client;
  readonly status: ClientStatus;
  readonly expanded: boolean;
  readonly onToggle: () => void;
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
          <Button variant="secondary-nav" href={`/clients/edit/${client.id}`}>
            Editar
          </Button>
        </div>
      }
    />
  );
}
