'use client';

import React from 'react';
import { Badge, Button, STATE_TO_FAMILY, type BadgeFamily } from '@/shared/components/ui';
import { getTypeLabel } from '../../utils/requirementHelpers';
import styles from './RequirementHeader.module.scss';
import type {
  Requirement,
  RequirementPriority,
  RequirementState,
  RequirementType,
  UpdateRequirementPayload,
} from '../../types/requirement.types';

interface RequirementHeaderProps {
  readonly requirement: Requirement;
  readonly onUpdate?: (payload: UpdateRequirementPayload) => void;
  readonly isPending?: boolean;
}

const STATE_OPTIONS: { label: string; value: RequirementState }[] = [
  { label: 'Análisis', value: 'analisis' },
  { label: 'Planificación', value: 'planificacion' },
  { label: 'En cola', value: 'en_cola' },
  { label: 'Desarrollo', value: 'desarrollo' },
  { label: 'Revisión', value: 'revision' },
  { label: 'Resuelto', value: 'resuelto' },
  { label: 'Cancelado', value: 'cancelado' },
];

const STATE_LABELS: Record<RequirementState, string> = {
  analisis: 'Análisis',
  planificacion: 'Planificación',
  en_cola: 'En cola',
  desarrollo: 'Desarrollo',
  revision: 'Revisión',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

const TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Sin tipo', value: '' },
  { label: 'Funcionalidad', value: 'funcionalidad' },
  { label: 'Mejora', value: 'mejora' },
  { label: 'Incidencia', value: 'incidencia' },
  { label: 'Otro', value: 'otro' },
];

const PRIORITY_OPTIONS: { label: string; value: RequirementPriority }[] = [
  { label: 'Sin prioridad', value: 'sin_prioridad' },
  { label: 'Baja', value: 'baja' },
  { label: 'Media', value: 'media' },
  { label: 'Alta', value: 'alta' },
  { label: 'Urgente', value: 'urgente' },
];

const PRIORITY_LABELS: Record<RequirementPriority, string> = {
  sin_prioridad: 'Sin prioridad',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

// La prioridad no forma parte de STATE_TO_FAMILY (ese mapa cubre los estados del requisito):
// tiene su propia correspondencia, del spec de Badge.
const PRIORITY_TO_FAMILY: Record<RequirementPriority, BadgeFamily> = {
  sin_prioridad: 'neutral',
  baja: 'neutral',
  media: 'review',
  alta: 'urgent',
  urgente: 'urgent',
};

export function RequirementHeader({ requirement, onUpdate, isPending }: RequirementHeaderProps) {
  const { id, title, state, type, priority } = requirement;
  void isPending;

  // Sin estado local: los badges son 100% controlados por `requirement` (React Query es la
  // única fuente de verdad). Si una mutación falla, el rollback optimista del hook
  // (useUpdateRequirement) revierte el cache y este componente refleja ese valor de
  // inmediato en el siguiente render.
  const canEdit = !!onUpdate;

  const handleStateChange = (value: string) => {
    if (value === state) return;
    onUpdate?.({ state: value as RequirementState });
  };

  const handleTypeChange = (value: string) => {
    const current = type ?? '';
    if (value === current) return;
    onUpdate?.({ type: (value === '' ? null : value) as RequirementType });
  };

  const handlePriorityChange = (value: string) => {
    if (value === priority) return;
    onUpdate?.({ priority: value as RequirementPriority });
  };

  const typeLabel = getTypeLabel((type ?? '') as RequirementType);

  return (
    <div className={styles.pageHeader}>
      <div className={styles.headerLeft}>
        <h1 className={styles.reqTitle}>{title}</h1>
        <div className={styles.badgesRow}>
          <Badge variant="outline" label={`#${id}`} />

          {canEdit ? (
            <Badge
              variant="editable"
              family={STATE_TO_FAMILY[state] ?? 'neutral'}
              label={STATE_LABELS[state]}
              options={STATE_OPTIONS}
              onChange={handleStateChange}
            />
          ) : (
            <Badge
              variant="state"
              family={STATE_TO_FAMILY[state] ?? 'neutral'}
              label={STATE_LABELS[state]}
            />
          )}

          {canEdit ? (
            <Badge
              variant="editable"
              family="neutral"
              label={typeLabel}
              options={TYPE_OPTIONS}
              onChange={handleTypeChange}
            />
          ) : (
            <Badge variant="outline" label={typeLabel} />
          )}

          {canEdit ? (
            <Badge
              variant="editable"
              family={PRIORITY_TO_FAMILY[priority]}
              label={PRIORITY_LABELS[priority]}
              options={PRIORITY_OPTIONS}
              onChange={handlePriorityChange}
            />
          ) : (
            <Badge
              variant="outline"
              family={PRIORITY_TO_FAMILY[priority]}
              label={PRIORITY_LABELS[priority]}
            />
          )}
        </div>
      </div>
      <div className={styles.headerActions}>
        <Button variant="secondary-nav" href="/requirements">
          Volver
        </Button>
        <Button variant="secondary-nav" href={`/requirements/${id}/edit`}>
          Editar
        </Button>
      </div>
    </div>
  );
}
