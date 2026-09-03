'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tooltip } from '@/shared/components/ui/Tooltip/Tooltip';
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

interface PillDropdownProps<T extends string> {
  value: T;
  options: { label: string; value: T }[];
  badgeClass: string;
  dataAttr: string;
  disabled?: boolean;
  disabledValues?: T[];
  disabledTooltip?: string;
  prefix?: React.ReactNode;
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
}

function PillDropdown<T extends string>({
  value,
  options,
  badgeClass,
  dataAttr,
  disabled,
  disabledValues,
  disabledTooltip,
  prefix,
  onChange,
  getLabel,
}: PillDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const label = options.find((o) => o.value === value)?.label ?? getLabel?.(value) ?? value;

  return (
    <div className={styles.pillWrapper} ref={ref}>
      <button
        type="button"
        className={`${badgeClass} ${disabled ? styles.pillDisabled : styles.pillClickable}`}
        {...{ [dataAttr]: value }}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        {prefix}
        {label}
        {!disabled && <span className={styles.pillChevron}>▾</span>}
      </button>
      {open && (
        <div className={styles.pillMenu} role="listbox">
          {options.map((opt) => {
            const isDisabled = disabledValues?.includes(opt.value);
            const optionButton = (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                aria-disabled={isDisabled}
                className={`${styles.pillMenuItem} ${opt.value === value ? styles.pillMenuItemActive : ''} ${isDisabled ? styles.pillMenuItemDisabled : ''}`}
                onClick={() => {
                  setOpen(false);
                  if (isDisabled || opt.value === value) return;
                  onChange(opt.value);
                }}
              >
                {opt.label}
              </button>
            );

            if (isDisabled && disabledTooltip) {
              return (
                <Tooltip key={opt.value} content={disabledTooltip}>
                  {optionButton}
                </Tooltip>
              );
            }

            return optionButton;
          })}
        </div>
      )}
    </div>
  );
}

export function RequirementHeader({ requirement, onUpdate, isPending }: RequirementHeaderProps) {
  const { id, title } = requirement;
  // Sin estado local: la Pill es 100% controlada por `requirement` (React Query es la
  // única fuente de verdad). Si una mutación falla, el rollback optimista del hook
  // (useUpdateRequirement) revierte el cache y este componente refleja ese valor de
  // inmediato en el siguiente render — sin necesitar sincronización manual vía useEffect,
  // que antes podía quedar "pegada" al valor optimista si el prop nunca llegaba a cambiar.
  const { state, type, priority } = requirement;

  const canEdit = !!onUpdate;

  return (
    <div className={styles.pageHeader}>
      <div className={styles.headerLeft}>
        <h1 className={styles.reqTitle}>{title}</h1>
        <div className={styles.badgesRow}>
          <span className={styles.reqCode}>#{id}</span>

          <PillDropdown
            value={state}
            options={STATE_OPTIONS}
            badgeClass={`${styles.badge} ${styles.badgeState}`}
            dataAttr="data-state"
            disabled={!canEdit || isPending}
            prefix={<span className={styles.dot} />}
            onChange={(v) => onUpdate?.({ state: v })}
            getLabel={(value) => STATE_LABELS[value]}
          />

          <PillDropdown
            value={type ?? ''}
            options={TYPE_OPTIONS}
            badgeClass={`${styles.badge} ${styles.badgeType}`}
            dataAttr="data-type"
            disabled={!canEdit || isPending}
            onChange={(v) => onUpdate?.({ type: (v === '' ? null : v) as RequirementType })}
            getLabel={(value) => getTypeLabel(value as RequirementType)}
          />

          <PillDropdown
            value={priority}
            options={PRIORITY_OPTIONS}
            badgeClass={`${styles.badge} ${styles.badgePriority}`}
            dataAttr="data-priority"
            disabled={!canEdit || isPending}
            onChange={(v) => onUpdate?.({ priority: v })}
          />
        </div>
      </div>
      <div className={styles.headerActions}>
        <Link href="/requirements" className={styles.backButton}>
          Volver
        </Link>
        <Link href={`/requirements/${id}/edit`} className={styles.editButton}>
          Editar
        </Link>
      </div>
    </div>
  );
}
