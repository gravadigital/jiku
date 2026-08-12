'use client';

import { Calendar } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Dropdown } from '@/shared/components/ui';
import type {
  Requirement,
  RequirementState,
  RequirementPriority,
} from '../../types/requirement.types';
import { useUpdateRequirement } from '../../hooks/useUpdateRequirement';
import {
  REQUIREMENT_STATE_ITEMS,
  REQUIREMENT_PRIORITY_ITEMS,
} from '../../constants/requirement.constants';
import styles from './ListRequirementRow.module.scss';

interface ListRequirementRowProps {
  requirement: Requirement;
  stateLabel: string;
  onRowClick?: () => void;
}

const PILL_CLASSES: Record<string, string> = {
  analisis: styles.backlog,
  planificacion: styles.planificacion,
  en_cola: styles.enCola,
  desarrollo: styles.active,
  revision: styles.review,
  resuelto: styles.done,
  cancelado: styles.cancelado,
};

const DOT_CLASSES: Record<string, string> = {
  analisis: styles.dotBacklog,
  planificacion: styles.dotPlanificacion,
  en_cola: styles.dotEnCola,
  desarrollo: styles.dotActive,
  revision: styles.dotReview,
  resuelto: styles.dotDone,
  cancelado: styles.dotCancelado,
};

const PRIORITY_LABEL: Record<string, string> = {
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

const PRIORITY_CLASS: Record<string, string> = {
  sin_prioridad: styles.priorityNone,
  baja: styles.priorityLow,
  media: styles.priorityMedium,
  alta: styles.priorityHigh,
  urgente: styles.priorityUrgent,
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StateDot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  );
}

function PriorityIcon({ color }: { color: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill={color}
      stroke="none"
      style={{ flexShrink: 0 }}
    >
      <path d="M5 3a1 1 0 0 0-1 1v17a1 1 0 0 0 2 0v-6h11.382a1 1 0 0 0 .894-1.447L16.118 10l2.158-3.553A1 1 0 0 0 17.382 5H6V4a1 1 0 0 0-1-1z" />
    </svg>
  );
}

export function ListRequirementRow({
  requirement,
  stateLabel,
  onRowClick,
}: ListRequirementRowProps) {
  const { mutate } = useUpdateRequirement(requirement.projectId);
  const { data: session } = useSession();
  const isInternal =
    session?.user?.roles?.includes('user') || session?.user?.roles?.includes('admin');

  const pillClass = PILL_CLASSES[requirement.state] || styles.backlog;
  const dotClass = DOT_CLASSES[requirement.state] || styles.dotBacklog;
  const priorityLabel = PRIORITY_LABEL[requirement.priority] ?? 'Sin prioridad';
  const priorityClass = PRIORITY_CLASS[requirement.priority] ?? styles.priorityNone;
  const priorityColor =
    REQUIREMENT_PRIORITY_ITEMS.find((p) => p.id === requirement.priority)?.color ?? '#64748b';

  function handleStateSelect(item: { id: string | number; label: string }) {
    if (item.id === requirement.state) return;
    mutate({ requirementId: requirement.id, payload: { state: item.id as RequirementState } });
  }

  function handlePrioritySelect(item: { id: string | number; label: string }) {
    if (item.id === requirement.priority) return;
    mutate({
      requirementId: requirement.id,
      payload: { priority: item.id as RequirementPriority },
    });
  }

  return (
    <div className={styles.row} onClick={onRowClick}>
      <div className={styles.tdId}>#{requirement.id}</div>
      <div className={styles.td}>
        <span className={styles.taskName}>{requirement.title}</span>
      </div>

      {/* Columna ESTADO */}
      <div className={styles.td}>
        <div onClick={(e) => e.stopPropagation()} className={styles.pillWrapper}>
          {isInternal ? (
            <Dropdown
              renderTrigger={(isOpen) => (
                <span className={`${styles.pill} ${pillClass}`}>
                  <span className={`${styles.dot} ${dotClass}`} />
                  {stateLabel}
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
              items={REQUIREMENT_STATE_ITEMS as unknown as { id: string | number; label: string }[]}
              onSelect={handleStateSelect}
              renderItem={(item) => {
                const stateItem = REQUIREMENT_STATE_ITEMS.find((s) => s.id === item.id);
                return (
                  <span className={styles.dropdownItem}>
                    <StateDot color={stateItem?.dotColor ?? '#94a3b8'} />
                    {item.label}
                  </span>
                );
              }}
              className={styles.pillDropdown}
              triggerClassName={styles.pillTrigger}
            />
          ) : (
            <span className={`${styles.pill} ${pillClass}`}>
              <span className={`${styles.dot} ${dotClass}`} />
              {stateLabel}
            </span>
          )}
        </div>
      </div>

      <div className={styles.td}>
        <div className={styles.dateCell}>
          <Calendar size={12} />
          <span>{formatDate(requirement.createdAt)}</span>
        </div>
      </div>
      <div className={styles.td}>
        <span className={styles.creator}>{requirement.creator?.name ?? '—'}</span>
      </div>
      <div className={styles.td}>
        <span className={styles.typeText}>{getTypeLabel(requirement.type)}</span>
      </div>

      {/* Columna PRIORIDAD */}
      <div className={`${styles.td} ${styles.tdPriority}`}>
        <div onClick={(e) => e.stopPropagation()} className={styles.pillWrapper}>
          {isInternal ? (
            <Dropdown
              renderTrigger={(isOpen) => (
                <span className={`${styles.priorityPill} ${priorityClass}`}>
                  <PriorityIcon color={priorityColor} />
                  {priorityLabel}
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
              items={
                REQUIREMENT_PRIORITY_ITEMS as unknown as { id: string | number; label: string }[]
              }
              onSelect={handlePrioritySelect}
              renderItem={(item) => {
                const pItem = REQUIREMENT_PRIORITY_ITEMS.find((p) => p.id === item.id);
                return (
                  <span className={styles.dropdownItem}>
                    <PriorityIcon color={pItem?.color ?? '#64748b'} />
                    {item.label}
                  </span>
                );
              }}
              align="right"
              className={styles.pillDropdown}
              triggerClassName={styles.pillTrigger}
            />
          ) : (
            <span className={`${styles.priorityPill} ${priorityClass}`}>
              <PriorityIcon color={priorityColor} />
              {priorityLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
