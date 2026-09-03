import React from 'react';
import { Tooltip } from '@/shared/components/ui';
import styles from './AreaTag.module.scss';
import type { IPerson } from '@/shared/types';

interface AreaTagProps {
  readonly persons: IPerson[];
  readonly area: string;
  readonly projectName: string;
  readonly showProject?: boolean;
}

export function AreaTag(props: AreaTagProps) {
  const { persons, area, projectName, showProject = false } = props;
  const leaderPerson = persons.find((person) => person.PersonObjective?.isLeader);
  const [firstPerson, ...restPersons] = leaderPerson
    ? [leaderPerson, ...persons.filter((person) => person !== leaderPerson)]
    : persons;
  const remainingPersonsCount = restPersons.length;
  const tooltipContent = persons
    .map((person) => `${person.firstName} ${person.lastName}`)
    .join(', ');
  let label = 'Sin Asignar';
  if (showProject) {
    label = projectName;
  } else if (firstPerson) {
    label = `${firstPerson.firstName} ${firstPerson.lastName}`;
  }

  return (
    <div className={styles.labelContainer}>
      <Tooltip content={area}>
        <span className={styles.areaLabel} data-area={area} />
      </Tooltip>
      <Tooltip content={showProject ? projectName : tooltipContent}>
        <span className={styles.responsibleLabel}>
          {label}
          {!showProject && remainingPersonsCount > 0 && ` +${remainingPersonsCount}`}
        </span>
      </Tooltip>
    </div>
  );
}
