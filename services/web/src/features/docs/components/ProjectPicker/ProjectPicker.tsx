'use client';

import React, { useMemo } from 'react';
import { useClients } from '@/features/clients';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Select } from '@/shared/components/ui';
import { projectClientId } from '../../utils/relationFields';

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
  const { data: clients } = useClients();

  const clientNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of clients ?? []) if (c.id !== undefined) map.set(c.id, c.name);
    return map;
  }, [clients]);

  const options = useMemo(
    () =>
      (projects ?? [])
        // El listado puede traer solo `clientId` (respaldo): no se lee `client.id` directo.
        .filter(
          (p) => p.id !== undefined && (clientId === undefined || projectClientId(p) === clientId)
        )
        .map((p) => {
          const projectClient = projectClientId(p);
          const clientName =
            p.client?.name ??
            (projectClient === null ? undefined : clientNameById.get(projectClient));
          return {
            value: String(p.id),
            name: p.name,
            clientId: projectClient,
            label: clientName ? `${p.name} · ${clientName}` : p.name,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [projects, clientNameById, clientId]
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
