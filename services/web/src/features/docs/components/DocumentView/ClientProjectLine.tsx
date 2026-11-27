import React from 'react';
import Link from 'next/link';
import styles from './DocumentView.module.scss';
import type { DocsClientRef, DocsProjectRef } from '../../types/docs.types';

interface ClientProjectLineProps {
  readonly clientRefs: readonly DocsClientRef[];
  readonly projectRefs: readonly DocsProjectRef[];
}

const more = (list: readonly unknown[]) => (list.length > 1 ? ` +${list.length - 1}` : '');

/**
 * `{cliente} · {proyecto} #{id}` en lugar de la ruta. El primero de cada lista es el principal;
 * un id que la base no conoce se muestra `#id` sin nombre ni enlace.
 */
export function ClientProjectLine({ clientRefs, projectRefs }: ClientProjectLineProps) {
  const client = clientRefs[0];
  const project = projectRefs[0];

  const clientText = client ? (client.name ?? `#${client.id}`) : 'Sin cliente';

  let projectNode: React.ReactNode = 'Sin proyecto';
  if (project) {
    projectNode = project.name ? (
      <>
        <Link href={`/projects/${project.id}`} className={styles.projectLink}>
          {project.name}
        </Link>
        {` #${project.id}`}
      </>
    ) : (
      `#${project.id}`
    );
  }

  return (
    <p className={styles.clientProject}>
      {`${clientText}${more(clientRefs)} · `}
      {projectNode}
      {more(projectRefs)}
    </p>
  );
}
