import React from 'react';
import { TagProject } from '../TagProject';
import styles from './ProjectPriorityTag.module.scss';

interface ProjectPriorityTagProps {
  readonly value: number;
}

export function ProjectPriorityTag(props: ProjectPriorityTagProps) {
  const { value } = props;

  return (
    <TagProject
      icon={<span className={styles.icon} data-priority={value} />}
      text={`Prioridad ${value}`}
    />
  );
}
