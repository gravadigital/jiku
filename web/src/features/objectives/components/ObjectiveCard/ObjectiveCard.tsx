'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, DateLabel, FinishDateLabel } from '@/shared/components/ui';
import { calculateDaysLeft } from '@/shared/utils';
import questionIcon from '@root/assets/question-icon.svg';
import scheduleIcon from '@root/assets/schedule-icon.svg';
import starIcon from '@root/assets/star-icon.svg';
import { isOverdue } from '../../utils/objectiveHelpers';
import { AreaTag } from '../AreaTag';
import { StateTag } from '../StateTag';
import styles from './ObjectiveCard.module.scss';
import type { Objective, Person, WorkedTime } from '@/shared/types';
import type { TCurrentUser } from '@root/hooks/use-current-user';

const formatWorkedMinutes = (workedMinutes: number) => {
  const hours = Math.floor(workedMinutes / 60);
  const minutes = workedMinutes % 60;
  const hourLabel = hours === 1 ? 'h' : 'hs';
  const worked = hours === 1 ? 'trabajada' : 'trabajadas';

  if (hours === 0) {
    return `${minutes} min trabajados`;
  } else if (minutes === 0) {
    return `${hours} ${hourLabel} ${worked}`;
  }

  return `${hours} ${hourLabel} ${minutes} min ${worked}`;
};

const shouldRenderTooltip = (_workedTime: WorkedTime[]) => {
  if (_workedTime) {
    return Boolean(_workedTime.length);
  }
  return false;
};

const groupWorkedTimeByPerson = (workedTimeArray: WorkedTime[], allPersons?: Person[] | null) => {
  const groupedByPerson = workedTimeArray.reduce(
    (acc, wt) => {
      const personId = wt.personId;
      if (!acc[personId]) {
        acc[personId] = {
          personId,
          person: wt.person || allPersons?.find((p) => p?.id === personId),
          totalMinutes: 0,
        };
      }
      acc[personId].totalMinutes += wt.minutes;
      return acc;
    },
    {} as Record<number, { personId: number; person?: Person; totalMinutes: number }>
  );

  return Object.values(groupedByPerson);
};

/**
 * Sub-estado de vencimiento, preservado tal cual del código pre-migración: se usa para el
 * texto de `DateLabel`/`FinishDateLabel`, aunque desde S-056 sólo `expired` tiñe la card
 * (Card variant task-overdue, AC-5 de T-7: "el pie se tiñe SÓLO cuando está vencida").
 */
function getCardClass(
  finishedAt: Date | null | undefined,
  estimatedFinishDate: Date | null | undefined,
  state: string
): 'closeToDeadline' | 'expired' | 'finished' | 'default' | 'expiresToday' {
  if (finishedAt) {
    return 'finished';
  }

  if (estimatedFinishDate) {
    const date = new Date(estimatedFinishDate);
    const daysLeft = calculateDaysLeft(date);

    if (daysLeft === 0) {
      return 'expiresToday';
    } else if (daysLeft < 0) {
      return isOverdue(state, estimatedFinishDate) ? 'expired' : 'default';
    } else if (daysLeft <= 7) {
      return 'closeToDeadline';
    }
  }

  return 'default';
}

export function ObjectiveCard({
  id,
  state,
  title,
  description,
  priority,
  workedMinutes,
  createdAt,
  updatedAt,
  estimatedFinishDate,
  area,
  persons,
  project,
  showProject,
  portalContainer,
  finishedAt,
  allPersons,
  workedTime,
  user,
}: Objective & {
  readonly user?: TCurrentUser | null;
  readonly portalContainer: HTMLDivElement | null;
  readonly allPersons?: Person[] | null;
}) {
  const personUserIds = useMemo(() => new Set(persons.map((person) => person.userId)), [persons]);
  const cardClass = getCardClass(finishedAt, estimatedFinishDate, state);
  const isImResponsible = Boolean(user && personUserIds.has(user.id));

  return (
    <Link href={`/objectives/${id}`} className={styles.cardLink}>
      <Card
        variant={cardClass === 'expired' ? 'task-overdue' : 'task'}
        title={title}
        headingLevel="h3"
        header={
          isImResponsible ? (
            <Image
              src={starIcon}
              alt=""
              width={20}
              height={20}
              title="Soy parte de esta tarea"
            />
          ) : undefined
        }
        footer={
          <div className={styles.bottomContent}>
            <DateLabel date={createdAt} label="Creación" cardClass={cardClass} />
            <DateLabel date={updatedAt} label="Modificación" cardClass={cardClass} />
            <FinishDateLabel
              objectiveId={id || 0}
              state={state}
              priority={priority}
              estimatedFinishDate={estimatedFinishDate}
              finishedAt={finishedAt}
              area={area}
              persons={persons}
              title={title}
              description={description}
              cardClass={cardClass}
              portalContainer={portalContainer}
            />
          </div>
        }
      >
        <div className={styles.middleContent}>
          <StateTag
            objectiveId={id || 0}
            state={state}
            priority={priority}
            estimatedFinishDate={estimatedFinishDate}
            area={area}
            persons={persons}
            title={title}
            description={description}
          />
          <AreaTag
            persons={persons}
            area={area}
            projectName={project.name}
            showProject={showProject}
          />
        </div>
        <div className={styles.workedTimeContainer}>
          <Image src={scheduleIcon} alt="" width={20} height={20} />
          <p className={styles.workedText}>
            {workedMinutes !== undefined && `${formatWorkedMinutes(workedMinutes)}`}
          </p>
          <div className={styles.personsWorkedTimes}>
            <div className={styles.workedTimesTooltip}>
              {shouldRenderTooltip(workedTime!)
                ? groupWorkedTimeByPerson(workedTime!, allPersons).map((groupedTime) => {
                    const person = groupedTime.person;
                    return (
                      <p key={groupedTime.personId} className={styles.tooltipText}>
                        {`${person?.firstName} ${
                          person?.lastName
                        }: ${formatWorkedMinutes(groupedTime.totalMinutes)}`}
                      </p>
                    );
                  })
                : null}
            </div>
            {shouldRenderTooltip(workedTime!) ? (
              <Image src={questionIcon} alt="" width={16} height={16} />
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
