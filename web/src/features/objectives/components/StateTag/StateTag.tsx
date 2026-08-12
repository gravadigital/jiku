'use client';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useUpdateObjective } from '@/features/objectives/hooks/useUpdateObjective';
import styles from './StateTag.module.scss';
import type { UpdateObjectivePayload } from '@/features/objectives/types';
import type { Person } from '@/shared/types';

interface StateTagProps {
  readonly state: string;
  readonly objectiveId: number;
  readonly priority: number;
  readonly estimatedFinishDate?: Date | null;
  readonly area: string;
  readonly persons: Person[];
  readonly title: string;
  readonly description?: string | null;
}

const stateOptions = [
  { label: 'Activo', value: 'activo' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'En revisión', value: 'en_revision' },
  { label: 'Cancelado', value: 'cancelado' },
  { label: 'Finalizado', value: 'finalizado' },
];

export function StateTag(props: StateTagProps) {
  const { state, objectiveId, title, priority, estimatedFinishDate, area, persons, description } =
    props;
  const [selectedState, setSelectedState] = useState(state);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const personIds = persons.map((person) => person.id);
  const { mutate: updateObjective } = useUpdateObjective();

  const handleChange = (newValue: string) => {
    setSelectedState(newValue);
    setIsDropdownOpen(false);

    const fieldsToUpdate: UpdateObjectivePayload = {
      area,
      personIds,
      priority,
      state: newValue,
      title,
    };

    if (estimatedFinishDate) {
      fieldsToUpdate.estimatedFinishDate = estimatedFinishDate;
    }

    if (description) {
      fieldsToUpdate.description = description;
    }

    updateObjective(
      { id: objectiveId, payload: fieldsToUpdate },
      {
        onSuccess: () => toast.success(`Se cambió el estado de la tarea a ${newValue}`),
        onError: () => {
          setSelectedState(state);
          toast.error('Hubo un error al cambiar el estado');
        },
      }
    );
  };

  const handleOptionClick = (event: React.MouseEvent<HTMLButtonElement>, newValue: string) => {
    event.stopPropagation();
    event.preventDefault();
    handleChange(newValue);
  };

  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className={styles.dropdown}>
      <button
        type="button"
        className={styles.statusSelect}
        data-state={selectedState}
        onClick={handleButtonClick}
      >
        {stateOptions.find((option) => option.value === selectedState)?.label}
      </button>
      {isDropdownOpen ? (
        <div className={styles.dropdownContent}>
          {stateOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={styles.statusSelectOption}
              data-state={option.value}
              onClick={(event) => handleOptionClick(event, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
