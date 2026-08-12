'use client';

import React, { useMemo } from 'react';
import ReactSelect, { type GroupBase, type SingleValue } from 'react-select';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { usePersonObjectives } from '../../hooks/usePersonObjectives';
import { usePersonRequirements } from '../../hooks/usePersonRequirements';
import styles from './TargetSelector.module.scss';
import type { TargetSelection } from '../../types/worked-time.types';

interface TargetSelectorProps {
  readonly personId: number;
  readonly value: TargetSelection | null;
  readonly onSelect: (selection: TargetSelection | null) => void;
}

type TargetOptionType = 'project' | 'requirement' | 'objective';

interface TargetOption {
  value: string;
  label: string;
  type: TargetOptionType;
  projectId: number | null;
  projectName?: string;
}

const customStyles = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: (provided: any, state: any) => ({
    ...provided,
    '&:hover': {
      cursor: 'pointer',
    },
    backgroundColor: '#fff',
    border: '0.5px solid var(--color-general-border)',
    borderRadius: 'var(--radius-items)',
    color: 'var(--color-general-title)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 400,
    lineHeight: '1.5rem',
    outline: state.isFocused ? '2px solid var(--color-highlighted)' : 'none',
    width: '100%',
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupHeading: (provided: any) => ({
    ...provided,
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: 'var(--color-general-text)',
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: (provided: any) => ({ ...provided, margin: 0, paddingTop: 0, paddingBottom: 0 }),
};

export function TargetSelector({ personId, value, onSelect }: TargetSelectorProps) {
  const { data: projects = [] } = useProjects({ filters: { state: 'activo,analisis' } });
  const { data: requirements = [] } = usePersonRequirements(personId);
  const { data: objectives = [] } = usePersonObjectives(personId);

  const groupedOptions = useMemo<GroupBase<TargetOption>[]>(() => {
    const projectOptions: TargetOption[] = projects.map((p) => ({
      value: `project-${p.id}`,
      label: `${p.name} (${p.code})`,
      type: 'project',
      projectId: p.id ?? null,
      projectName: p.name,
    }));

    const requirementOptions: TargetOption[] = requirements.map((r) => ({
      value: `requirement-${r.id}`,
      label: r.projectName ? `${r.title} — ${r.projectName}` : r.title,
      type: 'requirement',
      projectId: r.projectId,
    }));

    const objectiveOptions: TargetOption[] = objectives.map((o) => ({
      value: `objective-${o.id}`,
      label: `${o.title} → ${o.projectName}`,
      type: 'objective',
      projectId: o.projectId,
    }));

    return [
      { label: 'Proyectos', options: projectOptions },
      { label: 'Requisitos', options: requirementOptions },
      { label: 'Tareas', options: objectiveOptions },
    ];
  }, [projects, requirements, objectives]);

  const allOptions = useMemo(
    () => groupedOptions.flatMap((group) => group.options),
    [groupedOptions]
  );

  const selectedOption = useMemo(() => {
    if (!value) return null;
    if (value.objectiveId != null) {
      return allOptions.find((o) => o.value === `objective-${value.objectiveId}`) ?? null;
    }
    if (value.requirementId != null) {
      return allOptions.find((o) => o.value === `requirement-${value.requirementId}`) ?? null;
    }
    if (value.projectId != null) {
      return allOptions.find((o) => o.value === `project-${value.projectId}`) ?? null;
    }
    return null;
  }, [value, allOptions]);

  const handleChange = (option: SingleValue<TargetOption>) => {
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
    <div className={styles.container}>
      <label className={styles.label} id="target-selector-label">
        Proyecto / Requisito / Tarea
      </label>
      <ReactSelect<TargetOption, false, GroupBase<TargetOption>>
        inputId="target-selector"
        instanceId="target-selector"
        aria-labelledby="target-selector-label"
        options={groupedOptions}
        value={selectedOption}
        onChange={handleChange}
        placeholder="Buscar proyecto, requisito o tarea..."
        isClearable
        isSearchable
        styles={customStyles}
        noOptionsMessage={() => 'Sin resultados'}
      />
    </div>
  );
}
