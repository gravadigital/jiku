'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Input, Select } from '@/shared/components/ui';
import { InputMultipleSelect } from '@/shared/components/ui/InputMultipleSelect';
import styles from './RequirementFilters.module.scss';
import type { RequirementFilters as Filters } from '../../types/requirement.types';

const useDebouncedValue = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// La opción "Todos los estados" (value '') ya no existe: con selección múltiple sería un estado
// contradictorio ("todos" elegido junto a dos estados concretos). "Todos" pasa a ser la ausencia
// de selección (sentinel `all`, ver S-041 / REQ-009 RF-4, RF-6). Orden: el del enum
// `requirement_state`, no alfabético.
const STATE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Análisis', value: 'analisis' },
  { label: 'Planificación', value: 'planificacion' },
  { label: 'En cola', value: 'en_cola' },
  { label: 'Desarrollo', value: 'desarrollo' },
  { label: 'Revisión', value: 'revision' },
  { label: 'Resuelto', value: 'resuelto' },
  { label: 'Cancelado', value: 'cancelado' },
];

const getStateLabel = (value: string): string => {
  const option = STATE_OPTIONS.find((o) => o.value === value);
  return option ? option.label : value;
};

const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Más recientes', value: 'recent' },
  { label: 'Más antiguos', value: 'oldest' },
  { label: 'Prioridad', value: 'priority' },
];

interface RequirementFiltersProps {
  readonly filters: Filters;
  readonly onChange: (key: keyof Filters, value: string) => void;
}

export function RequirementFilters({ filters, onChange }: RequirementFiltersProps) {
  const { data: projects = [] } = useProjects({ filters: { state: 'analisis,activo' } });
  const currentSearch = String(filters.search || '');
  const [searchInput, setSearchInput] = useState(currentSearch);
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const lastAppliedSearch = useRef(currentSearch);

  useEffect(() => {
    if (debouncedSearch === lastAppliedSearch.current) return;
    lastAppliedSearch.current = debouncedSearch;
    onChange('search', debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const projectOptions: { label: string; value: string }[] = [
    { label: 'Todos los proyectos', value: '' },
    ...[...projects]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ label: p.name, value: String(p.id) })),
  ];

  return (
    <div className={styles.filterSection}>
      <div className={styles.filterField}>
        <Input
          variant="search"
          label="Búsqueda"
          placeholder="Buscar requisito"
          value={searchInput}
          onChange={handleSearchChange}
        />
      </div>
      <div className={styles.filterField}>
        <InputMultipleSelect
          compact
          label="Estados"
          code="filter-state"
          placeholder="Todos los estados"
          options={STATE_OPTIONS}
          value={
            !filters.state || filters.state === 'all'
              ? []
              : String(filters.state)
                  .split(',')
                  .filter(Boolean)
                  .map((s) => ({ label: getStateLabel(s), value: s }))
          }
          onChange={(values) =>
            onChange('state', values.length === 0 ? 'all' : values.map((v) => v.value).join(','))
          }
        />
      </div>
      <div className={styles.filterField}>
        {/* `searchable`: hay ~100 proyectos y encontrar uno scrolleando es impracticable.
            El selector tenía buscador con `react-select` antes de S-057; la migración al
            Select del DS lo perdió porque el componente no lo tenía. */}
        <Select
          variant="single"
          label="Proyecto"
          placeholder="Todos los proyectos"
          options={projectOptions}
          value={String(filters.projectId ?? '')}
          onChange={(value) => onChange('projectId', value)}
          searchable
        />
      </div>
      <div className={styles.filterField}>
        <Select
          variant="single"
          label="Ordenar por"
          options={SORT_OPTIONS}
          value={filters.sort ?? 'recent'}
          onChange={(value) => onChange('sort', value)}
        />
      </div>
    </div>
  );
}
