'use client';
import React from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './ObjectiveStateFilter.module.scss';
import type { ObjectiveState } from '@/features/objectives/types/objective.types';

interface ObjectiveStateFilterProps {
  readonly selectedStates: ObjectiveState[];
  readonly onChange: (states: ObjectiveState[]) => void;
}

const ACTIVE_STATES: ObjectiveState[] = ['backlog', 'activo', 'en_revision'];

const CHIP_CONFIG = [
  { key: 'todos' as const, label: 'Todos' },
  { key: 'backlog' as const, label: 'Backlog' },
  { key: 'activo' as const, label: 'Activo' },
  { key: 'en_revision' as const, label: 'En revisión' },
];

export function ObjectiveStateFilter({ selectedStates, onChange }: ObjectiveStateFilterProps) {
  const allSelected = ACTIVE_STATES.every((s) => selectedStates.includes(s));

  const handleTodosClick = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...ACTIVE_STATES]);
    }
  };

  const handleChipClick = (state: ObjectiveState) => {
    if (selectedStates.includes(state)) {
      onChange(selectedStates.filter((s) => s !== state));
    } else {
      onChange([...selectedStates, state]);
    }
  };

  return (
    <div className={styles.container}>
      {CHIP_CONFIG.map(({ key, label }) => {
        const isTodos = key === 'todos';
        const isActive = isTodos ? allSelected : selectedStates.includes(key as ObjectiveState);

        return (
          <button
            key={key}
            type="button"
            className={cn(styles.chip, isActive && styles.chipActive)}
            data-state={isTodos ? 'todos' : key}
            data-active={isActive ? 'true' : 'false'}
            onClick={() => {
              if (isTodos) {
                handleTodosClick();
              } else {
                handleChipClick(key as ObjectiveState);
              }
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
