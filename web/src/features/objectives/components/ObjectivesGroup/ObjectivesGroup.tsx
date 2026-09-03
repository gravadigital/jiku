'use client';
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePersons } from '@/features/auth';
import { Button } from '@/shared/components/ui';
import scheduleIcon from '@root/assets/schedule-icon2.svg';
import { ObjectiveCard } from '../ObjectiveCard';
import styles from './ObjectivesGroup.module.scss';
import type { Objective } from '@/shared/types';

export function ObjectivesGroup({
  title,
  projectId,
  personId,
  objectives,
  showProject,
  currentMonthHours,
  currentMonthMinutes,
}: {
  readonly title: string;
  readonly projectId?: number;
  readonly personId?: number;
  readonly objectives: Objective[];
  readonly showProject?: boolean;
  readonly currentMonthHours?: number;
  readonly currentMonthMinutes?: number;
}) {
  const portalContainerRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const { data: persons } = usePersons();

  useEffect(() => {
    setPortalContainer(portalContainerRef.current);
  }, []);

  const buildHref = () => {
    if (projectId) {
      return `/objectives/new?projectId=${projectId}`;
    } else if (personId) {
      return `/objectives/new?personId=${personId}`;
    }
    return '/objectives/new';
  };

  const formatMonthHours = () => {
    if (typeof currentMonthHours === 'undefined') {
      return '';
    }
    if (currentMonthHours === 0 && currentMonthMinutes === 0) {
      return '0 hs';
    }
    const hoursText = currentMonthHours > 0 ? `${currentMonthHours} hs` : '';
    const minutesText =
      currentMonthMinutes && currentMonthMinutes > 0
        ? `${currentMonthHours > 0 ? ' ' : ''}${currentMonthMinutes} min`
        : '';
    return `${hoursText}${minutesText}`;
  };

  return (
    <>
      <h2 className={styles.title}>
        <div className={styles.titleContainer}>
          {title}
          {typeof currentMonthHours !== 'undefined' && (
            <div className={styles.monthHoursWrapper}>
              <span className={styles.monthHoursTag}>
                <Image src={scheduleIcon} alt="" width={14} height={14} />
                {formatMonthHours()}
              </span>
              <div className={styles.monthHoursTooltip}>Trabajadas en el mes</div>
            </div>
          )}
          <Button fab aria-label="Nueva tarea" href={buildHref()}>
            +
          </Button>
        </div>
      </h2>
      <div className={styles.containerObjectives}>
        {objectives.map((objective) => {
          return (
            <div className={styles.objectiveItem} key={objective.id}>
              <ObjectiveCard
                allPersons={persons ?? null}
                area={objective.area}
                title={objective.title}
                description={objective.description}
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
                persons={objective.persons}
                showProject={showProject ?? false}
                creator={objective.creator}
                workedMinutes={objective.workedMinutes}
                workedTime={objective.workedTime}
                portalContainer={portalContainer}
                finishedAt={objective.finishedAt}
                visibilityLevel={objective.visibilityLevel}
              />
            </div>
          );
        })}
      </div>
      <div ref={portalContainerRef} className={styles.portalContainer} />
    </>
  );
}
