import React from 'react';
import { Tooltip } from '@/shared/components/ui';
import {
  calculateTimeSince,
  formatDate,
  getObjectiveState,
  getObjectiveTypeOfActivity,
} from '@/shared/utils';
import { ObjectiveComment } from '../ObjectiveComment';
import styles from './ObjectiveHistoryList.module.scss';
import type { ObjectiveActivity } from '@/shared/types';

interface ObjectiveHistoryListProps {
  readonly objectiveActivity: ObjectiveActivity[];
  readonly objectiveId: number;
}

export function ObjectiveHistoryList(props: ObjectiveHistoryListProps) {
  const { objectiveActivity, objectiveId } = props;

  const comments = objectiveActivity
    .filter((activity) => activity.typeOfActivity === 'comment')
    .sort(
      (activityA, activityB) =>
        new Date(activityA.createdAt).getTime() - new Date(activityB.createdAt).getTime()
    );
  const otherActivities = objectiveActivity.filter(
    (activity) => activity.typeOfActivity !== 'comment'
  );

  const renderActivityContent = (activities: ObjectiveActivity[]) => {
    if (activities.length === 0) {
      return <div className={styles.noActivity}>No hay cambios aún</div>;
    }

    return (
      <ul className={styles.connectedList}>
        {activities.map((activity) => (
          <li key={activity.id}>
            <div className={styles.listContainer}>
              <span>{activity.user.name}</span>
              {' cambió '}
              <span>{getObjectiveTypeOfActivity(activity.typeOfActivity)}</span>
              {activity.typeOfActivity === 'description' ? null : (
                <>
                  {activity.previousValue === '' ? '' : ' de '}
                  <span className={activity.previousValue ? styles.previousValue : ''}>
                    {getObjectiveState(activity.previousValue)}
                  </span>
                  {' a '}
                  <span className={styles.newValue}>
                    {activity.newValue ? getObjectiveState(activity.newValue) : 'No definida'}
                  </span>
                </>
              )}{' '}
              <Tooltip message={formatDate(new Date(activity.createdAt))}>
                <span className={styles.commentDate}>
                  {' Hace '}
                  {calculateTimeSince(new Date(activity.createdAt))}
                </span>
              </Tooltip>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  const renderComments = (commentActivities: ObjectiveActivity[]) => {
    if (commentActivities.length === 0) {
      return <div className={styles.noActivity}>No hay comentarios aún</div>;
    }

    return (
      <ul className={styles.connectedComments}>
        {commentActivities.map((comment) => (
          <li key={comment.id} className={styles.comment}>
            <ObjectiveComment
              authorName={comment.user.name}
              authorId={comment.user.id || ''}
              date={comment.createdAt}
              updateDate={comment.updatedAt}
              content={comment.newValue}
              previousValue={comment.previousValue}
              commentId={comment.id!}
              objectiveId={objectiveId}
              visibilityLevel={comment.visibilityLevel}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.activityTitle}>Historial de cambios</h2>
      <ul>{renderActivityContent(otherActivities)}</ul>

      <h2 className={styles.activityTitle}>Comentarios</h2>
      <ul>{renderComments(comments)}</ul>
    </div>
  );
}
