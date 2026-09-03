'use client';

import React from 'react';
import { Select } from '@/shared/components/ui/Select';
import type { ProjectType } from '@/features/projects/types/project.types';

interface ProjectTypeFilterDropdownProps {
  readonly value: ProjectType[];
  readonly onChange: (types: ProjectType[]) => void;
}

const PROJECT_TYPE_OPTIONS: { label: string; value: ProjectType }[] = [
  { label: 'Comercial', value: 'comercial' },
  { label: 'Interno', value: 'interno' },
  { label: 'Investigación', value: 'investigacion' },
  { label: 'Propuesta', value: 'propuesta' },
];

export function ProjectTypeFilterDropdown({ value, onChange }: ProjectTypeFilterDropdownProps) {
  const label = value.length > 0 ? `Tipo de proyecto (${value.length})` : 'Tipo de proyecto';

  return (
    <Select
      variant="multiple"
      label={label}
      options={PROJECT_TYPE_OPTIONS}
      value={value}
      onChange={(next) => onChange(next as ProjectType[])}
      placeholder="Tipo de proyecto"
    />
  );
}
