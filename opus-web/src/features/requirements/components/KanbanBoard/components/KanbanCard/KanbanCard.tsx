'use client';

import { Calendar, User } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Dropdown } from '@/shared/components/ui';
import type {
  Requirement,
  RequirementState,
  RequirementPriority,
} from '@/features/requirements/types/requirement.types';
import { useUpdateRequirement } from '@/features/requirements/hooks/useUpdateRequirement';
import {
  REQUIREMENT_STATE_ITEMS,
  REQUIREMENT_PRIORITY_ITEMS,
} from '@/features/requirements/constants/requirement.constants';
import styles from './KanbanCard.module.scss';

interface KanbanCardProps {
  requirement: Requirement;
  stateLabel: string;
  onClick?: () => void;
}

const PRIORITY_LABEL: Record<string, string> = {
  sin_prioridad: 'Sin prioridad',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

const PRIORITY_CLASS: Record<string, string> = {
  sin_prioridad: styles.priorityNone,
  baja: styles.priorityLow,
  media: styles.priorityMedium,
  alta: styles.priorityHigh,
  urgente: styles.priorityUrgent,
};

const DOT_CLASSES: Record<string, string> = {
  analisis: styles.dotBacklog,
  planificacion: styles.dotPlanificacion,
  en_cola: styles.dotEnCola,
  desarrollo: styles.dotActive,
  revision: styles.dotRevision,
  resuelto: styles.dotResuelto,
  cancelado: styles.dotCancelado,
};

const PILL_CLASSES: Record<string, string> = {
  analisis: styles.pillBacklog,
  planificacion: styles.pillPlanificacion,
  en_cola: styles.pillEnCola,
  desarrollo: styles.active,
  revision: styles.pillRevision,
  resuelto: styles.pillResuelto,
  cancelado: styles.pillCancelado,
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getUTCDate();
  const month = date.toLocaleString('es', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function StateDot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
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
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill={color}
      stroke="none"
      style={{ flexShrink: 0 }}
    >
      <path d="M5 3a1 1 0 0 0-1 1v17a1 1 0 0 0 2 0v-6h11.382a1 1 0 0 0 .894-1.447L16.118 10l2.158-3.553A1 1 0 0 0 17.382 5H6V4a1 1 0 0 0-1-1z" />
    </svg>
  );
}

export function KanbanCard({ requirement, stateLabel, onClick }: KanbanCardProps) {
  const { id, title, state, priority, createdAt, creator, description, projectId } = requirement;
  const { mutate } = useUpdateRequirement(projectId);
  const { data: session } = useSession();
  const isInternal =
    session?.user?.roles?.includes('user') || session?.user?.roles?.includes('admin');

  const dotClass = DOT_CLASSES[state] ?? '';
  const pillClass = PILL_CLASSES[state] ?? '';
  const priorityLabel = PRIORITY_LABEL[priority] ?? 'Sin prioridad';
  const priorityClass = PRIORITY_CLASS[priority] ?? styles.priorityNone;
  const priorityColor =
    REQUIREMENT_PRIORITY_ITEMS.find((p) => p.id === priority)?.color ?? '#64748b';
  const formattedDate = createdAt ? formatDate(createdAt) : '—';

  function handleStateSelect(item: { id: string | number; label: string }) {
    if (item.id === state) return;
    mutate({ requirementId: id, payload: { state: item.id as RequirementState } });
  }

  function handlePrioritySelect(item: { id: string | number; label: string }) {
    if (item.id === priority) return;
    mutate({ requirementId: id, payload: { priority: item.id as RequirementPriority } });
  }

  return (
    <article className={styles.card} onClick={onClick}>
      <div className={styles.id}>#{id}</div>
      <div className={styles.title}>{title}</div>

      <div className={styles.meta}>
        <span className={styles.date}>
          <Calendar size={11} />
          {formattedDate}
        </span>
        <span className={styles.divider}>·</span>
        <span className={styles.creator}>
          <User size={11} />
          {creator?.name ?? '—'}
        </span>
      </div>

      {description && (
        <div className={styles.pills}>
          {/* Pill de estado */}
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
                        marginLeft: 3,
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
                  REQUIREMENT_STATE_ITEMS as unknown as { id: string | number; label: string }[]
                }
                onSelect={handleStateSelect}
                renderItem={(item) => {
                  const s = REQUIREMENT_STATE_ITEMS.find((x) => x.id === item.id);
                  return (
                    <span className={styles.dropdownItem}>
                      <StateDot color={s?.dotColor ?? '#94a3b8'} />
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

          {/* Badge de prioridad */}
          <div onClick={(e) => e.stopPropagation()} className={styles.pillWrapper}>
            {isInternal ? (
              <Dropdown
                renderTrigger={(isOpen) => (
                  <span className={`${styles.badge} ${priorityClass}`}>
                    <PriorityIcon color={priorityColor} />
                    {priorityLabel}
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      style={{
                        marginLeft: 3,
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
                  const p = REQUIREMENT_PRIORITY_ITEMS.find((x) => x.id === item.id);
                  return (
                    <span className={styles.dropdownItem}>
                      <PriorityIcon color={p?.color ?? '#64748b'} />
                      {item.label}
                    </span>
                  );
                }}
                className={styles.pillDropdown}
                triggerClassName={styles.pillTrigger}
              />
            ) : (
              <span className={`${styles.badge} ${priorityClass}`}>
                <PriorityIcon color={priorityColor} />
                {priorityLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
