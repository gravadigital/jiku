'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AutomatedIdentityBadge, RichContentRenderer } from '@/shared/components/ui';
import { SubscribersList } from '@/features/subscriptions/components/SubscribersList';
import type { RequirementDetail } from '@/features/requirements/types/requirement.types';
import styles from './RequirementInfoPanel.module.scss';

interface RequirementInfoPanelProps {
  requirement: RequirementDetail;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Sin fecha';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Sin fecha';
  return format(date, "d 'de' MMMM yyyy", { locale: es });
}

function getLastActivityAt(requirement: RequirementDetail): string | null {
  if (!requirement.requirementActivity || requirement.requirementActivity.length === 0) return null;
  const dates = requirement.requirementActivity.map((a) => a.createdAt).filter(Boolean);
  if (dates.length === 0) return null;
  return dates.reduce((max, d) => (d > max ? d : max));
}

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

function getTypeLabel(type: string | null | undefined): string {
  if (!type || type === 'sin_tipo') return 'Sin tipo';
  return TYPE_LABELS[type] ?? type;
}

const STATE_LABELS: Record<string, string> = {
  analisis: 'Análisis',
  planificacion: 'Planificación',
  en_cola: 'En cola',
  desarrollo: 'Desarrollo',
  revision: 'Revisión',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

const STATE_DOT_CLASS: Record<string, string> = {
  analisis: styles.dotBacklog,
  planificacion: styles.dotPlanificacion,
  en_cola: styles.dotEnCola,
  desarrollo: styles.dotActive,
  revision: styles.dotReview,
  resuelto: styles.dotDone,
  cancelado: styles.dotCancelado,
};

const PRIORITY_ICON_CLASS: Record<string, string> = {
  sin_prioridad: styles.priorityIconNone,
  baja: styles.priorityIconLow,
  media: styles.priorityIconMedium,
  alta: styles.priorityIconHigh,
  urgente: styles.priorityIconUrgent,
};

export function RequirementInfoPanel({ requirement }: RequirementInfoPanelProps) {
  const createdDate = formatDate(requirement.createdAt);
  const lastActivityDate = formatDate(getLastActivityAt(requirement));
  const stateDotClass = STATE_DOT_CLASS[requirement.state] ?? styles.dotBacklog;
  const priorityIconClass = PRIORITY_ICON_CLASS[requirement.priority] ?? styles.priorityIconNone;

  return (
    <div className={styles.panel} data-testid="requirement-info-panel">
      {/* Two-column layout: sidebar left + main content right */}
      <div className={styles.layout}>
        {/* Sidebar: properties list */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarTitle}>Estado</div>
            <div className={styles.sidebarValue}>
              <span className={`${styles.dot} ${stateDotClass}`} aria-hidden="true" />
              {STATE_LABELS[requirement.state] ?? requirement.state}
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarTitle}>Tipo</div>
            <div className={styles.sidebarValue}>{getTypeLabel(requirement.type)}</div>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarTitle}>Prioridad</div>
            <div className={styles.sidebarValue}>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
                className={priorityIconClass}
                aria-hidden="true"
              >
                <path d="M5 3a1 1 0 0 0-1 1v17a1 1 0 0 0 2 0v-6h11.382a1 1 0 0 0 .894-1.447L16.118 10l2.158-3.553A1 1 0 0 0 17.382 5H6V4a1 1 0 0 0-1-1z" />
              </svg>
              {PRIORITY_LABELS[requirement.priority] ?? requirement.priority}
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarTitle}>Suscriptores</div>
            <SubscribersList subscribers={requirement.subscriptors} />
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarTitle}>Fecha de creación</div>
            <div className={styles.sidebarValueEmpty}>{createdDate}</div>
          </div>

          {requirement.finishedAt && (
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarTitle}>Fecha de finalización</div>
              <div className={styles.sidebarValueEmpty}>{formatDate(requirement.finishedAt)}</div>
            </div>
          )}

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarTitle}>Última actualización</div>
            <div className={styles.sidebarValueEmpty}>{lastActivityDate}</div>
          </div>
        </div>

        {/* Main content */}
        <div className={styles.main}>
          <h2 className={styles.title}>{requirement.title}</h2>

          <div className={styles.description}>
            {requirement.description ? (
              <RichContentRenderer content={requirement.description} />
            ) : (
              <span className={styles.descriptionEmpty}>Sin descripción</span>
            )}
          </div>

          {requirement.type === 'incidencia' && requirement.resolutionComment && (
            <div className={styles.resolution}>
              <div className={styles.resolutionTitle}>Resolución</div>
              <div className={styles.resolutionContent}>
                <RichContentRenderer content={requirement.resolutionComment} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className={styles.footer}>
            Elemento creado por&nbsp;<strong>{requirement.creator?.name ?? '—'}</strong>
            <AutomatedIdentityBadge
              identityType={requirement.creator?.identityType}
              className={styles.identityBadge}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
