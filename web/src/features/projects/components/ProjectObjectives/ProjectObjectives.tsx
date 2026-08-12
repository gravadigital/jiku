import React from 'react';
import { ObjectivesGroup } from '@/features/objectives';
import type { Objective } from '@/features/objectives/types';

interface ProjectObjectivesProps {
  readonly projectId: number;
  readonly projectName: string;
  readonly objectives: Objective[];
  readonly currentMonthHours?: number;
  readonly currentMonthMinutes?: number;
}

/**
 * Los objetivos de un proyecto, en una sola lista.
 *
 * Reemplaza a la vista que los agrupaba por etapa: el concepto de etapa se eliminó del
 * producto.
 */
export function ProjectObjectives({
  projectId,
  projectName,
  objectives,
  currentMonthHours,
  currentMonthMinutes,
}: ProjectObjectivesProps) {
  return (
    <div id={`project-${projectId}`}>
      <ObjectivesGroup
        key={`objectives-group-proj-${projectId}`}
        title={projectName}
        projectId={projectId}
        objectives={objectives}
        currentMonthHours={currentMonthHours}
        currentMonthMinutes={currentMonthMinutes}
      />
    </div>
  );
}
