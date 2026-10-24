'use client';

import React from 'react';
import Link from 'next/link';
import { useClient } from '@/features/clients/hooks/useClient';
import { useObjective } from '@/features/objectives/hooks/useObjective';
import { useProject } from '@/features/projects/hooks/useProject';
import { useRequirement } from '@/features/requirements/hooks/useRequirement';
import { Badge, Card } from '@/shared/components/ui';
import styles from './DocumentRelations.module.scss';
import type { DocsRelations } from '../../types/docs.types';

interface DocumentRelationsProps {
  readonly relations?: DocsRelations;
  readonly topics?: readonly string[];
}

interface RelationRowProps {
  readonly typeLabel: string;
  readonly id: number;
  readonly href: string;
  readonly name?: string;
}

function RelationRow({ typeLabel, id, href, name }: RelationRowProps) {
  return (
    <li className={styles.row}>
      <span className={styles.type}>{typeLabel}</span>
      <Link href={href} className={styles.link}>
        {name || `${typeLabel} #${id}`}
      </Link>
    </li>
  );
}

// Un subcomponente por vínculo: cada uno usa su propio hook de detalle por id. Mientras carga
// o si falla, la fila muestra `{Tipo} #{id}` (TS-53).
const ClientRow = ({ id }: { id: number }) => {
  const { data } = useClient({ id });
  return <RelationRow typeLabel="Cliente" id={id} href={`/clients/edit/${id}`} name={data?.name} />;
};
const ProjectRow = ({ id }: { id: number }) => {
  const { data } = useProject({ id });
  return <RelationRow typeLabel="Proyecto" id={id} href={`/projects/${id}`} name={data?.name} />;
};
const RequirementRow = ({ id }: { id: number }) => {
  const { data } = useRequirement(id);
  return (
    <RelationRow typeLabel="Requisito" id={id} href={`/requirements/${id}`} name={data?.title} />
  );
};
const TaskRow = ({ id }: { id: number }) => {
  const { data } = useObjective({ id });
  return <RelationRow typeLabel="Tarea" id={id} href={`/objectives/${id}`} name={data?.title} />;
};

export function DocumentRelations({ relations, topics }: DocumentRelationsProps) {
  const clients = relations?.clients ?? [];
  const projects = relations?.projects ?? [];
  const requirements = relations?.requirements ?? [];
  const tasks = relations?.tasks ?? [];
  const total = clients.length + projects.length + requirements.length + tasks.length;

  return (
    <Card variant="panel" title="Vinculado a" headingLevel="h2">
      {total === 0 ? (
        <p className={styles.empty}>
          Este documento no está vinculado a ningún proyecto, requisito ni tarea.
        </p>
      ) : (
        <ul className={styles.list}>
          {clients.map((id) => (
            <ClientRow key={`c-${id}`} id={id} />
          ))}
          {projects.map((id) => (
            <ProjectRow key={`p-${id}`} id={id} />
          ))}
          {requirements.map((id) => (
            <RequirementRow key={`r-${id}`} id={id} />
          ))}
          {tasks.map((id) => (
            <TaskRow key={`t-${id}`} id={id} />
          ))}
        </ul>
      )}
      {topics && topics.length > 0 && (
        <div className={styles.topics}>
          <h3 className={styles.topicsTitle}>Temas</h3>
          <ul className={styles.topicList}>
            {topics.map((topic) => (
              <li key={topic}>
                <Badge variant="outline" family="neutral" label={topic} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
