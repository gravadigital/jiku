import React from 'react';
import Link from 'next/link';
import { Card } from '@/shared/components/ui';
import styles from './DocumentLinkedTo.module.scss';
import type { DocsClientRef, DocsProjectRef, DocsTitleRef } from '../../types/docs.types';

interface DocumentLinkedToProps {
  readonly clientRefs: readonly DocsClientRef[];
  readonly projectRefs: readonly DocsProjectRef[];
  readonly requirementRefs: readonly DocsTitleRef[];
  readonly taskRefs: readonly DocsTitleRef[];
}

interface RowProps {
  readonly typeLabel: string;
  readonly id: number;
  readonly name: string | null;
  readonly href?: string;
  /** El cliente se muestra sin `#id`. */
  readonly showId?: boolean;
}

function Row({ typeLabel, id, name, href, showId = true }: RowProps) {
  const known = name !== null && name !== '';
  return (
    <li className={styles.row}>
      <span className={styles.type}>{typeLabel}</span>
      <span>
        {known && href ? (
          <Link href={href} className={styles.link}>
            {name}
          </Link>
        ) : (
          known && name
        )}
        {known ? (
          showId && <span className={styles.id}>{` #${id}`}</span>
        ) : (
          <span className={styles.id}>{`#${id}`}</span>
        )}
      </span>
    </li>
  );
}

/** Los nombres los resuelve la api (`*Refs`): sin un hook por id. */
export function DocumentLinkedTo({
  clientRefs,
  projectRefs,
  requirementRefs,
  taskRefs,
}: DocumentLinkedToProps) {
  const total = clientRefs.length + projectRefs.length + requirementRefs.length + taskRefs.length;

  return (
    <Card variant="panel" title="Vinculado a" headingLevel="h2">
      {total === 0 ? (
        <p className={styles.empty}>
          Este documento no está vinculado a ningún cliente, proyecto, requisito ni tarea.
        </p>
      ) : (
        <ul className={styles.list}>
          {clientRefs.map((ref) => (
            <Row
              key={`c-${ref.id}`}
              typeLabel="Cliente"
              id={ref.id}
              name={ref.name}
              showId={false}
            />
          ))}
          {projectRefs.map((ref) => (
            <Row
              key={`p-${ref.id}`}
              typeLabel="Proyecto"
              id={ref.id}
              name={ref.name}
              href={`/projects/${ref.id}`}
            />
          ))}
          {requirementRefs.map((ref) => (
            <Row
              key={`r-${ref.id}`}
              typeLabel="Requisito"
              id={ref.id}
              name={ref.title}
              href={`/requirements/${ref.id}`}
            />
          ))}
          {taskRefs.map((ref) => (
            <Row
              key={`t-${ref.id}`}
              typeLabel="Tarea"
              id={ref.id}
              name={ref.title}
              href={`/objectives/${ref.id}`}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
