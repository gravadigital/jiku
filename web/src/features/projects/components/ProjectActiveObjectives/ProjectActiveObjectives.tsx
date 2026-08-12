'use client';
import React, { useMemo, useState } from 'react';
import { ObjectiveCard } from '@/features/objectives/components/ObjectiveCard';
import { useObjectives } from '@/features/objectives/hooks/useObjectives';
import { Loader } from '@/shared/components/ui/Loader';
import { useCurrentUser } from '@root/hooks/use-current-user';
import { ObjectiveStateFilter } from '../ObjectiveStateFilter';
import styles from './ProjectActiveObjectives.module.scss';
import type { ObjectiveState } from '@/features/objectives/types/objective.types';

interface ProjectActiveObjectivesProps {
  readonly projectId: number;
}

const ACTIVE_STATES: ObjectiveState[] = ['backlog', 'activo', 'en_revision'];

export function ProjectActiveObjectives({ projectId }: ProjectActiveObjectivesProps) {
  const user = useCurrentUser();
  const [selectedStates, setSelectedStates] = useState<ObjectiveState[]>(['activo']);

  const {
    data: allObjectives = [],
    isLoading,
    isError,
  } = useObjectives({
    filters: { projectId },
  });

  const activeObjectives = useMemo(() => {
    return allObjectives
      .filter(
        (obj) =>
          ACTIVE_STATES.includes(obj.state as ObjectiveState) &&
          selectedStates.includes(obj.state as ObjectiveState)
      )
      .sort((a, b) => {
        if (!a.estimatedFinishDate && !b.estimatedFinishDate) return 0;
        if (!a.estimatedFinishDate) return 1;
        if (!b.estimatedFinishDate) return -1;
        return (
          new Date(a.estimatedFinishDate).getTime() - new Date(b.estimatedFinishDate).getTime()
        );
      });
  }, [allObjectives, selectedStates]);

  if (isLoading) {
    return <Loader label="Cargando tareas..." />;
  }

  if (isError) {
    return <p className={styles.message}>Error al cargar las tareas.</p>;
  }

  return (
    <div className={styles.container}>
      <ObjectiveStateFilter selectedStates={selectedStates} onChange={setSelectedStates} />
      {activeObjectives.length === 0 ? (
        <p className={styles.message}>No hay tareas para los filtros seleccionados.</p>
      ) : (
        <div className={styles.grid}>
          {activeObjectives.map((objective) => (
            <ObjectiveCard
              key={objective.id}
              user={user}
              area={objective.area}
              title={objective.title}
              description={objective.description}
              persons={objective.persons}
              priority={objective.priority}
              createdAt={new Date(objective.createdAt)}
              updatedAt={new Date(objective.updatedAt)}
              estimatedFinishDate={
                objective.estimatedFinishDate ? new Date(objective.estimatedFinishDate) : null
              }
              state={objective.state}
              id={objective.id}
              projectId={objective.projectId}
              project={objective.project}
              creator={objective.creator}
              workedMinutes={objective.workedMinutes}
              workedTime={objective.workedTime}
              portalContainer={null}
              finishedAt={objective.finishedAt}
              visibilityLevel={objective.visibilityLevel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
