'use client';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useUpdateObjective } from '@/features/objectives/hooks/useUpdateObjective';
import { Badge } from '@/shared/components/ui';
import type { UpdateObjectivePayload } from '@/features/objectives/types';
import type { BadgeFamily } from '@/shared/components/ui/Badge';
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

/**
 * Mapeo estado de dominio de `objectives` (`activo`/`backlog`/`en_revision`/`cancelado`/
 * `finalizado`) -> familia de color de `Badge`. Es un dominio de 5 estados distinto del que
 * mapea `STATE_TO_FAMILY` (6 estados de `requirements`/`projects`), así que no lo reusa.
 */
export const OBJECTIVE_STATE_TO_FAMILY: Record<string, BadgeFamily> = {
  activo: 'in-progress',
  backlog: 'neutral',
  cancelado: 'neutral',
  en_revision: 'review',
  finalizado: 'resolved',
};

export function StateTag(props: StateTagProps) {
  const { state, objectiveId, title, priority, estimatedFinishDate, area, persons, description } =
    props;
  const [selectedState, setSelectedState] = useState(state);
  const personIds = persons.map((person) => person.id);
  const { mutate: updateObjective } = useUpdateObjective();

  const handleChange = (newValue: string) => {
    setSelectedState(newValue);

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

  const currentLabel = stateOptions.find((option) => option.value === selectedState)?.label ?? '';

  return (
    <Badge
      variant="editable"
      family={OBJECTIVE_STATE_TO_FAMILY[selectedState] ?? 'neutral'}
      label={currentLabel}
      options={stateOptions}
      onChange={handleChange}
    />
  );
}
