'use client';

import React, { useMemo } from 'react';
import { useClients } from '@/features/clients';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Select } from '@/shared/components/ui';
import { chooseClient, chooseProject, type RelationValue } from '../../utils/relationFields';
import { ProjectPicker } from '../ProjectPicker';
import styles from './ClientProjectFields.module.scss';

interface ClientProjectFieldsProps {
  readonly value: RelationValue;
  readonly onChange: (next: RelationValue) => void;
  readonly disabled?: boolean;
  /** `row`: dos columnas 6/12 (alta). `stack`: uno debajo del otro (edición). */
  readonly layout?: 'row' | 'stack';
}

// Edita el principal (el primero de cada lista) y conserva el resto (REQ-021).
export function ClientProjectFields({
  value,
  onChange,
  disabled,
  layout = 'row',
}: ClientProjectFieldsProps) {
  const { data: clients } = useClients();
  const { data: projects } = useProjects();

  const projectClientOf = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const p of projects ?? []) if (p.id !== undefined) map.set(p.id, p.client?.id ?? null);
    return (id: number) => map.get(id) ?? null;
  }, [projects]);

  const clientOptions = useMemo(
    () => [
      { value: '', label: 'Sin cliente' },
      ...(clients ?? [])
        .filter((c) => c.id !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [clients]
  );

  const clientId = value.clients[0] ?? null;
  const projectId = value.projects[0] ?? null;
  const clientName =
    clientId === null ? null : (clients ?? []).find((c) => c.id === clientId)?.name;

  return (
    <div className={layout === 'row' ? styles.row : styles.stack}>
      <div className={styles.cell}>
        <Select
          variant="single"
          searchable
          label="Cliente"
          placeholder="Sin cliente"
          disabled={disabled}
          options={clientOptions}
          value={clientId === null ? '' : String(clientId)}
          onChange={(next) =>
            onChange(chooseClient(value, next === '' ? null : Number(next), projectClientOf))
          }
        />
      </div>
      <div className={styles.cell}>
        <ProjectPicker
          label="Proyecto"
          placeholder="Sin proyecto"
          emptyLabel="Sin proyecto"
          disabled={disabled}
          value={projectId}
          clientId={clientId ?? undefined}
          onClear={() => onChange({ ...value, projects: value.projects.slice(1) })}
          onChange={(id, _name, projectClient) =>
            onChange(chooseProject(value, { id, clientId: projectClient }))
          }
        />
        {clientName && <p className={styles.hint}>{`Solo los proyectos de ${clientName}`}</p>}
      </div>
    </div>
  );
}
