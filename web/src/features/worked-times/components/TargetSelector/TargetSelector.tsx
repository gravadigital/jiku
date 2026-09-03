'use client';

import React, { useMemo } from 'react';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Select, type SelectOption } from '@/shared/components/ui/Select';
import { usePersonObjectives } from '../../hooks/usePersonObjectives';
import { usePersonRequirements } from '../../hooks/usePersonRequirements';
import type { TargetSelection } from '../../types/worked-time.types';

interface TargetSelectorProps {
  readonly personId: number;
  readonly value: TargetSelection | null;
  readonly onSelect: (selection: TargetSelection | null) => void;
}

type TargetOptionType = 'project' | 'requirement' | 'objective';

interface TargetOption extends SelectOption {
  readonly type: TargetOptionType;
  readonly projectId: number | null;
  readonly projectName?: string;
}

export function TargetSelector({ personId, value, onSelect }: TargetSelectorProps) {
  const { data: projects = [] } = useProjects({ filters: { state: 'activo,analisis' } });
  const { data: requirements = [] } = usePersonRequirements(personId);
  const { data: objectives = [] } = usePersonObjectives(personId);

  // El Select del DS no soporta grupos (GroupBase de react-select): la agrupación
  // Proyectos/Requisitos/Tareas se conserva como prefijo visible en el label de cada
  // opción, para no perder la señal de a qué tipo de destino pertenece cada una.
  const allOptions = useMemo<TargetOption[]>(() => {
    const projectOptions: TargetOption[] = projects.map((p) => ({
      value: `project-${p.id}`,
      label: `Proyectos — ${p.name} (${p.code})`,
      type: 'project',
      projectId: p.id ?? null,
      projectName: p.name,
    }));

    const requirementOptions: TargetOption[] = requirements.map((r) => ({
      value: `requirement-${r.id}`,
      label: r.projectName
        ? `Requisitos — ${r.title} — ${r.projectName}`
        : `Requisitos — ${r.title}`,
      type: 'requirement',
      projectId: r.projectId,
    }));

    const objectiveOptions: TargetOption[] = objectives.map((o) => ({
      value: `objective-${o.id}`,
      label: `Tareas — ${o.title} → ${o.projectName}`,
      type: 'objective',
      projectId: o.projectId,
    }));

    return [...projectOptions, ...requirementOptions, ...objectiveOptions];
  }, [projects, requirements, objectives]);

  const selectedValue = useMemo(() => {
    if (!value) return '';
    if (value.objectiveId != null) return `objective-${value.objectiveId}`;
    if (value.requirementId != null) return `requirement-${value.requirementId}`;
    if (value.projectId != null) return `project-${value.projectId}`;
    return '';
  }, [value]);

  const handleChange = (nextValue: string) => {
    const option = allOptions.find((o) => o.value === nextValue);
    if (!option) {
      onSelect(null);
      return;
    }

    if (option.type === 'project') {
      onSelect({
        projectId: option.projectId,
        projectName: option.projectName,
        requirementId: null,
        objectiveId: null,
      });
      return;
    }

    if (option.type === 'requirement') {
      const requirementId = Number(option.value.replace('requirement-', ''));
      onSelect({
        projectId: option.projectId,
        requirementId,
        objectiveId: null,
      });
      return;
    }

    const objectiveId = Number(option.value.replace('objective-', ''));
    onSelect({
      projectId: option.projectId,
      requirementId: null,
      objectiveId,
    });
  };

  return (
    <Select
      label="Proyecto / Requisito / Tarea"
      options={allOptions}
      value={selectedValue}
      onChange={handleChange}
      placeholder="Buscar proyecto, requisito o tarea..."
    />
  );
}
