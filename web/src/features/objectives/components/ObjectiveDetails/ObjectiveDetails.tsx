'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { ProjectPriorityTag } from '@/features/projects';
import { useRequirement } from '@/features/requirements/hooks/useRequirement';
import { SectionCard } from '@/shared/components/ui';
import { getObjectiveArea, getObjectiveState, getObjectiveVisibility } from '@/shared/utils';
import styles from './ObjectiveDetails.module.scss';
import type { Objective } from '@/shared/types';

interface ObjectiveDetailsProps {
  readonly objective: Objective;
}

export function ObjectiveDetails({ objective }: ObjectiveDetailsProps) {
  const { push } = useRouter();
  const { data: linkedRequirement, isError: hasRequirementError } = useRequirement(
    objective.requirementId ?? 0,
    { enabled: Boolean(objective.requirementId) }
  );

  const renderPersonList = () => {
    if (objective.persons && objective.persons.length > 0) {
      const sortedPersons = [...objective.persons].sort((personA, personB) => {
        if (personA.PersonObjective?.isLeader && !personB.PersonObjective?.isLeader) {
          return -1;
        }
        if (!personA.PersonObjective?.isLeader && personB.PersonObjective?.isLeader) {
          return 1;
        }
        return 0;
      });

      return sortedPersons.map((person: any, index: number) => {
        const isFirstPerson = index === 0;
        return (
          <li key={person.id}>
            {`${person.firstName} ${person.lastName}
              ${isFirstPerson ? ' (Responsable)' : ''}`}
          </li>
        );
      });
    }
    return <li>No hay personas asignadas</li>;
  };

  const formatWorkedMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    return `${hours} hs`;
  };

  const handleClick = () => {
    if (objective.project) {
      push(`/projects/${objective.project.id}`);
    }
  };
  return (
    <SectionCard>
      <div className={styles.detailSection}>
        <div className={styles.priorityTagContainer}>
          <ProjectPriorityTag value={objective.priority} />
        </div>

        <div className={styles.metadataGrid}>
          <div className={styles.leftColumn}>
            <p className={styles.middleContent}>
              <span>Estado</span>
              {': '}
              <span className={styles.statusLabel} data-state={objective.state}>
                {getObjectiveState(objective.state)}
              </span>
            </p>

            <p>
              <span>Proyecto</span>
              {': '}
              <a onClick={handleClick}>
                {objective.project ? objective.project.name : 'No definido'}
              </a>
            </p>

            <p>
              <span>Área</span>
              {': '}
              {getObjectiveArea(objective.area)}
            </p>
            <p>
              <span>Visibilidad</span>
              {': '}
              {getObjectiveVisibility(objective.visibilityLevel)}
            </p>

            <p>
              <span>Creado por</span>
              {': '}
              {objective.creator.name}
            </p>

            {objective.requirementId ? (
              <p>
                <span>Requisito</span>
                {': '}
                {hasRequirementError ? (
                  'Requisito no disponible'
                ) : (
                  <Link href={`/requirements/${objective.requirementId}`}>
                    {linkedRequirement?.title}
                  </Link>
                )}
              </p>
            ) : null}
          </div>

          <div className={styles.rightColumn}>
            <p>
              <span>Fecha de inicio</span>
              {': '}
              {new Date(objective.createdAt).toUTCString().slice(4, 16)}
            </p>

            <p>
              <span>Fecha de finalización estimada</span>
              {': '}
              {objective.estimatedFinishDate
                ? new Date(objective.estimatedFinishDate).toUTCString().slice(4, 16)
                : 'No definida'}
            </p>

            {objective.finishedAt ? (
              <p>
                <span>Fecha de cierre</span>
                {': '}
                {new Date(objective.finishedAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            ) : null}

            <p>
              <span>Última actualización</span>
              {': '}
              {new Date(objective.updatedAt).toUTCString().slice(4, 16)}
            </p>

            {objective.workedMinutes > 0 && (
              <p>
                <span>Horas trabajadas</span>
                {': '}
                {formatWorkedMinutes(objective.workedMinutes)}
              </p>
            )}

            <h3>
              <span>Equipo</span>
              <ul>{renderPersonList()}</ul>
            </h3>
          </div>
        </div>

        <h3 className={styles.descriptionTitle}>
          <span>Descripción</span>
        </h3>
        <div className={styles.markdownContainer}>
          {objective.description ? (
            <MarkdownViewer content={objective.description} />
          ) : (
            'No definida'
          )}
        </div>
      </div>
    </SectionCard>
  );
}
