import React from 'react';
import { Card } from '@/shared/components/ui';
import { getProjectStatus } from '@/shared/utils';
import { PROJECT_STATUS_TO_FAMILY } from '../../utils/projectHelpers';
import styles from './ProjectCard.module.scss';
import type { Project } from '@/shared/types';

const PRIORITY_FAMILY: Record<number, 'urgent' | 'review' | 'neutral'> = {
  1: 'urgent',
  2: 'review',
};

function formatDateRange(initDate: Date, endDate?: Date): string {
  const start = initDate.toUTCString().slice(4, 16);
  if (endDate && endDate.getTime() && !isNaN(endDate.getTime())) {
    return `${start} - ${endDate.toUTCString().slice(4, 16)}`;
  }
  return start;
}

export function ProjectCard({
  name,
  status,
  type,
  initDate,
  endDate,
  id,
  description,
  priority,
}: Project) {
  return (
    <Card
      variant="project"
      title={name}
      href={`/projects/${id}`}
      headingLevel="h2"
      status={{ family: PROJECT_STATUS_TO_FAMILY[status], label: getProjectStatus(status) }}
      header={<span className={styles.dateLabel}>{formatDateRange(initDate, endDate)}</span>}
      tags={[
        { label: type, family: 'neutral' },
        { label: `Prioridad ${priority}`, family: PRIORITY_FAMILY[priority] ?? 'neutral' },
      ]}
    >
      <p className={styles.description}>{description}</p>
    </Card>
  );
}
