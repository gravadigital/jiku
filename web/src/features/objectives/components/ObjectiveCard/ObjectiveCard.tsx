'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { DateLabel, FinishDateLabel } from '@/shared/components/ui';
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

  const getCardClass = () => {
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
  };

  return (
    <Link href={`/objectives/${id}`} passHref>
      <div className={styles.objectiveCardContainer} data-state={getCardClass()}>
        <div className={styles.topComponent}>
          <h3 className={styles.title}>{title}</h3>
          {user && personUserIds.has(user.id) ? (
            <div className={styles.starIcon}>
              <Image
                src={starIcon}
                alt="responsable icon"
                width={20}
                height={20}
                title="Soy parte de esta tarea"
              />
            </div>
          ) : null}
        </div>
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
          <Image src={scheduleIcon} alt="schedule icon" height={20} />
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
              <Image src={questionIcon} alt="question icon" height={16} />
            ) : null}
          </div>
        </div>
        <div className={styles.bottomContent}>
          <DateLabel date={createdAt} label="Creación" cardClass={getCardClass()} />
          <DateLabel date={updatedAt} label="Modificación" cardClass={getCardClass()} />
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
            cardClass={getCardClass()}
            portalContainer={portalContainer}
          />
        </div>
      </div>
    </Link>
  );
}
