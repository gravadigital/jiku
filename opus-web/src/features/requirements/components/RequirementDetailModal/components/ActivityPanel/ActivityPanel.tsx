'use client';

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bot } from 'lucide-react';
import { AutomatedIdentityBadge, RichContentRenderer } from '@/shared/components/ui';
import type { RequirementActivity } from '@/features/requirements/types/requirement.types';
import styles from './ActivityPanel.module.scss';

interface ActivityPanelProps {
  activities: RequirementActivity[];
}

function formatRelativeDate(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: es,
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatFieldName(typeOfActivity: string): string {
  const fieldNames: Record<string, string> = {
    state: 'Estado',
    priority: 'Prioridad',
    type: 'Tipo',
    title: 'Título',
    description: 'Descripción',
  };
  return fieldNames[typeOfActivity] ?? typeOfActivity;
}

const STATE_LABELS: Record<string, string> = {
  analisis: 'Análisis',
  planificacion: 'Planificación',
  en_cola: 'En cola',
  desarrollo: 'Desarrollo',
  revision: 'Revisión',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
  // Valores del enum viejo (ADR-009), conservados como fallback legible para
  // historial de actividad persistido antes de REQ-040/S-064 (CA-4).
  programado: 'Programado',
  finalizado: 'Finalizado',
};

const PRIORITY_LABELS: Record<string, string> = {
  sin_prioridad: 'Sin prioridad',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

const TYPE_LABELS: Record<string, string> = {
  funcionalidad: 'Funcionalidad',
  mejora: 'Mejora',
  incidencia: 'Incidencia',
  otro: 'Otro',
};

function formatActivityValue(typeOfActivity: string, value: string): string {
  if (typeOfActivity === 'state') return STATE_LABELS[value] ?? value;
  if (typeOfActivity === 'priority') return PRIORITY_LABELS[value] ?? value;
  if (typeOfActivity === 'type') return TYPE_LABELS[value] ?? value;
  return value;
}

function CommentItem({ activity }: { activity: RequirementActivity }) {
  const authorName = activity.user?.name ?? 'Usuario';
  // La variant se deriva una sola vez: el avatar y el badge tienen que decir lo mismo.
  const isAutomated = activity.user?.identityType === 'service';

  return (
    <div className={styles.comment} data-variant={isAutomated ? 'identidad-automatica' : 'persona'}>
      <div className={styles.commentBody}>
        <div className={styles.commentHeader}>
          <div className={styles.commentAvatar} aria-hidden="true">
            {isAutomated ? <Bot size={16} /> : getInitials(authorName)}
          </div>
          <span className={styles.commentAuthor}>{authorName}</span>
          <AutomatedIdentityBadge
            identityType={activity.user?.identityType}
            className={styles.commentIdentityBadge}
          />
          <span className={styles.commentTime}>{formatRelativeDate(activity.createdAt)}</span>
        </div>
        {activity.newValue && (
          <div className={styles.commentText}>
            <RichContentRenderer content={activity.newValue} />
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeItem({ activity, isLast }: { activity: RequirementActivity; isLast: boolean }) {
  const fieldName = formatFieldName(activity.typeOfActivity);
  const authorName = activity.user?.name ?? 'Usuario';

  return (
    <div className={styles.event}>
      <div className={styles.eventDotWrap}>
        <span className={styles.dotSm} aria-hidden="true" />
        {!isLast && <span className={styles.eventLine} aria-hidden="true" />}
      </div>
      <div className={styles.eventBody}>
        <p className={styles.eventText}>
          <strong>{authorName}</strong>
          <AutomatedIdentityBadge
            identityType={activity.user?.identityType}
            className={styles.eventIdentityBadge}
          />
          {' cambió '}
          <span className={styles.fieldName}>{fieldName}</span>
          {activity.typeOfActivity !== 'description' &&
          activity.previousValue &&
          activity.newValue ? (
            <>
              {` de ${formatActivityValue(activity.typeOfActivity, activity.previousValue)} a `}
              <span className={styles.newValue}>
                {formatActivityValue(activity.typeOfActivity, activity.newValue)}
              </span>
            </>
          ) : null}
        </p>
        <span className={styles.eventTime}>{formatRelativeDate(activity.createdAt)}</span>
      </div>
    </div>
  );
}

export function ActivityPanel({ activities }: ActivityPanelProps) {
  const safeActivities = Array.isArray(activities) ? activities : [];
  const sorted = [...safeActivities].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className={styles.container} data-testid="activity-panel">
        <p className={styles.empty}>No hay actividad registrada</p>
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="activity-panel">
      {sorted.map((activity, index) => {
        if (activity.typeOfActivity === 'comment') {
          return <CommentItem key={activity.id} activity={activity} />;
        }
        const nextItem = sorted[index + 1];
        const isLast = !nextItem || nextItem.typeOfActivity === 'comment';
        return <ChangeItem key={activity.id} activity={activity} isLast={isLast} />;
      })}
    </div>
  );
}
