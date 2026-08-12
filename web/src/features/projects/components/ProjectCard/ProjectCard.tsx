import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getProjectStatus } from '@/shared/utils';
import calendar from '@root/assets/calendar.svg';
import { ProjectPriorityTag } from '../ProjectPriorityTag';
import { ProjectTypeTag } from '../ProjectTypeTag';
import styles from './ProjectCard.module.scss';
import type { Project } from '@/shared/types';

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
    <Link href={`/projects/${id}`} passHref>
      <div className={styles.projectCardContainer}>
        <div className={styles.headContent}>
          <div className={styles.dateLabel}>
            <Image src={calendar} alt="calendar icon" width={20} height={30} />
            <span>
              {initDate.toUTCString().slice(4, 16)}
              {endDate && endDate.getTime() && !isNaN(endDate.getTime())
                ? ` - ${endDate.toUTCString().slice(4, 16)}`
                : null}
            </span>
          </div>
        </div>
        <div className={styles.middleContent}>
          <span className={styles.statusLabel} data-status={status}>
            {getProjectStatus(status)}
          </span>
          <h2 className={styles.title}>{name}</h2>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.bottomContent}>
          <ProjectTypeTag value={type} />
          <ProjectPriorityTag value={priority} />
        </div>
      </div>
    </Link>
  );
}
