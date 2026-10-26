'use client';

import React, { useMemo } from 'react';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Select } from '@/shared/components/ui';

interface ProjectPickerProps {
  /** Id del proyecto elegido; `null` si todavía no hay. */
  readonly value: number | null;
  readonly onChange: (id: number, name: string, clientId: number | null) => void;
  /** Con `emptyLabel`, elegir esa primera opción llama a `onClear`. */
  readonly emptyLabel?: string;
  readonly onClear?: () => void;
  /** Limita a los proyectos de ese cliente. */
  readonly clientId?: number;
  readonly label?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

/** Selector de proyecto (`Select` single searchable). Lo comparten la fila "Sin proyecto" y "Nuevo documento". */
export function ProjectPicker({
  value,
  onChange,
  clientId,
  emptyLabel,
  onClear,
  label = 'Proyecto',
  placeholder = 'Buscar proyecto…',
  disabled,
}: ProjectPickerProps) {
  const { data: projects } = useProjects();

  const options = useMemo(
    () =>
      (projects ?? [])
        .filter((p) => p.id !== undefined && (clientId === undefined || p.client?.id === clientId))
        .map((p) => ({
          value: String(p.id),
          name: p.name,
          clientId: p.client?.id ?? null,
          label: p.client ? `${p.name} · ${p.client.name}` : p.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [projects, clientId]
  );

  return (
    <Select
      variant="single"
      searchable
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      options={[
        ...(emptyLabel ? [{ value: '', label: emptyLabel }] : []),
        ...options.map(({ value: v, label: l }) => ({ value: v, label: l })),
      ]}
      value={value === null ? '' : String(value)}
      onChange={(next) => {
        if (next === '') {
          onClear?.();
          return;
        }
        const chosen = options.find((o) => o.value === next);
        if (chosen) onChange(Number(chosen.value), chosen.name, chosen.clientId);
      }}
    />
  );
}
