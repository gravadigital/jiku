'use client';

import React from 'react';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { AutomatedIdentityBadge } from '@/shared/components/ui/AutomatedIdentityBadge';
import { calculateTimeSince } from '@/shared/utils/calculate-time-since';
import { getActivityFieldLabel, getActivityValueLabel } from '../../utils/requirementHelpers';
import styles from './RequirementActivityFeed.module.scss';
import type { RequirementActivity, RequirementState } from '../../types/requirement.types';

interface RequirementActivityFeedProps {
  readonly activity: RequirementActivity[];
}

const STATE_LABELS: Record<RequirementState, string> = {
  analisis: 'Análisis',
  planificacion: 'Planificación',
  en_cola: 'En cola',
  desarrollo: 'Desarrollo',
  revision: 'Revisión',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

function formatStateLabel(value: string | null): string {
  if (!value) return '—';
  return STATE_LABELS[value as RequirementState] ?? value;
}

function getActorName(entry: RequirementActivity): string {
  return entry.changedByUser?.name ?? entry.changedBy;
}

/**
 * El autor de una entrada del feed: su nombre y, cuando NO es una persona, la marca de
 * identidad automatica. Es el UNICO lugar de la pantalla donde se decide eso, y por eso
 * las cuatro formas de entrada (state, comment, resolution y generica) lo comparten.
 */
function ActorName({ entry }: { readonly entry: RequirementActivity }) {
  return (
    <>
      <strong>{getActorName(entry)}</strong>{' '}
      <AutomatedIdentityBadge identityType={entry.changedByUser?.identityType} />
    </>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = ['#43a047', '#1e88e5', '#e53935', '#8e24aa', '#f4511e', '#00897b'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatStateChange(entry: RequirementActivity): React.ReactNode {
  return (
    <>
      <ActorName entry={entry} />
      {' cambió el estado de '}
      <strong>{formatStateLabel(entry.previousValue)}</strong>
      {' a '}
      <strong className={styles.newValue}>{formatStateLabel(entry.newValue)}</strong>
    </>
  );
}

function formatComment(entry: RequirementActivity): React.ReactNode {
  return (
    <>
      <ActorName entry={entry} />
      {' comentó'}
    </>
  );
}

function formatResolution(entry: RequirementActivity): React.ReactNode {
  return (
    <>
      <ActorName entry={entry} />
      {' agregó una resolución'}
    </>
  );
}

function formatGeneric(entry: RequirementActivity): React.ReactNode {
  const fieldLabel = getActivityFieldLabel(entry.typeOfActivity);
  const showValues =
    entry.typeOfActivity !== 'description' &&
    Boolean(entry.previousValue) &&
    Boolean(entry.newValue);

  return (
    <>
      <ActorName entry={entry} />
      {' cambió '}
      {fieldLabel}
      {showValues && (
        <>
          {' de '}
          <strong>
            {getActivityValueLabel(entry.typeOfActivity, entry.previousValue as string)}
          </strong>
          {' a '}
          <strong className={styles.newValue}>
            {getActivityValueLabel(entry.typeOfActivity, entry.newValue)}
          </strong>
        </>
      )}
    </>
  );
}

export function RequirementActivityFeed({ activity }: RequirementActivityFeedProps) {
  if (activity.length === 0) {
    return <div className={styles.empty}>Sin actividad registrada</div>;
  }

  const sortedActivity = [...activity].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className={styles.feed}>
      {sortedActivity.map((entry) => {
        const isComment = entry.typeOfActivity === 'comment';
        const isState = entry.typeOfActivity === 'state';
        const isResolution = entry.typeOfActivity === 'resolution';
        const showText = isComment || isResolution;
        const timeAgo = `hace ${calculateTimeSince(new Date(entry.createdAt))}`;

        return (
          <div key={entry.id} className={styles.entry}>
            <div
              className={styles.avatar}
              style={{ background: getAvatarColor(getActorName(entry)) }}
            >
              {getInitials(getActorName(entry))}
            </div>
            <div className={styles.body}>
              <div className={styles.entryRow}>
                <div className={styles.text}>
                  {isState
                    ? formatStateChange(entry)
                    : isComment
                      ? formatComment(entry)
                      : isResolution
                        ? formatResolution(entry)
                        : formatGeneric(entry)}
                </div>
                {isComment && (
                  <span className={styles.visibility}>
                    {entry.visibilityLevel === 'internal' ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    )}
                    {entry.visibilityLevel === 'internal' ? 'Interno' : 'Público'}
                  </span>
                )}
              </div>
              {showText && (
                <div className={styles.comment}>
                  <MarkdownViewer content={entry.newValue} />
                </div>
              )}
              <div className={`${styles.time}${showText ? ` ${styles.timeAfterComment}` : ''}`}>
                {timeAgo}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
