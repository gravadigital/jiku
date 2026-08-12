'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactSelect from 'react-select';
import { useProjects } from '@/features/projects/hooks/useProjects';
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

const STATE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Todos los estados', value: '' },
  { label: 'Análisis', value: 'analisis' },
  { label: 'Planificación', value: 'planificacion' },
  { label: 'En cola', value: 'en_cola' },
  { label: 'Desarrollo', value: 'desarrollo' },
  { label: 'Revisión', value: 'revision' },
  { label: 'Resuelto', value: 'resuelto' },
  { label: 'Cancelado', value: 'cancelado' },
];

const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Más recientes', value: 'recent' },
  { label: 'Más antiguos', value: 'oldest' },
  { label: 'Prioridad', value: 'priority' },
];

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    height: '40px',
    minHeight: '40px',
    border: `1px solid #e6e8ed`,
    borderRadius: '8px',
    boxShadow: 'none',
    outline: state.isFocused ? '2px solid var(--color-highlighted)' : 'none',
    fontSize: '0.875rem',
    fontWeight: 400,
    backgroundColor: '#fff',
    cursor: 'pointer',
    '&:hover': { border: '1px solid #e6e8ed' },
  }),
  valueContainer: (base: Record<string, unknown>) => ({
    ...base,
    height: '40px',
    padding: '0 0.875rem',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'nowrap' as const,
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  indicatorsContainer: (base: Record<string, unknown>) => ({
    ...base,
    height: '40px',
    display: 'flex',
    alignItems: 'center',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    zIndex: 10,
    fontSize: '0.875rem',
    borderRadius: '8px',
    border: '1px solid #e6e8ed',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  }),
  option: (base: Record<string, unknown>, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    backgroundColor: state.isSelected ? '#DA2C6A' : state.isFocused ? '#e6e8ed' : '#fff',
    color: state.isSelected ? '#fff' : '#1F2633',
    cursor: 'pointer',
  }),
  singleValue: (base: Record<string, unknown>) => ({
    ...base,
    color: '#1F2633',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    height: '100%',
  }),
  placeholder: (base: Record<string, unknown>) => ({ ...base, color: '#aaa' }),
};

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

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const projectOptions: { label: string; value: string }[] = [
    { label: 'Todos los proyectos', value: '' },
    ...[...projects]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ label: p.name, value: String(p.id) })),
  ];

  return (
    <div className={styles.filterSection}>
      <div className={styles.filterField} style={{ flex: 2 }}>
        <label className={styles.fLabel}>Búsqueda</label>
        <input
          type="text"
          className={styles.fInput}
          placeholder="Buscar requisito"
          value={searchInput}
          onChange={handleSearchChange}
        />
      </div>
      <div className={styles.filterField} style={{ flex: 1.6 }}>
        <label className={styles.fLabel}>Estado</label>
        <ReactSelect
          inputId="filter-state"
          styles={selectStyles}
          options={STATE_OPTIONS}
          value={STATE_OPTIONS.find((o) => o.value === (filters.state ?? '')) ?? STATE_OPTIONS[0]}
          onChange={(opt) => onChange('state', opt?.value ?? '')}
          isSearchable={false}
        />
      </div>
      <div className={styles.filterField} style={{ flex: 1.2 }}>
        <label className={styles.fLabel}>Proyecto</label>
        <ReactSelect
          inputId="filter-project"
          styles={selectStyles}
          options={projectOptions}
          value={
            projectOptions.find((o) => o.value === String(filters.projectId ?? '')) ??
            projectOptions[0]
          }
          onChange={(opt) => onChange('projectId', opt?.value ?? '')}
        />
      </div>
      <div className={styles.filterField} style={{ flex: 1 }}>
        <label className={styles.fLabel}>Ordenar por</label>
        <ReactSelect
          inputId="filter-sort"
          styles={selectStyles}
          options={SORT_OPTIONS}
          value={
            SORT_OPTIONS.find((o) => o.value === (filters.sort ?? 'recent')) ?? SORT_OPTIONS[0]
          }
          onChange={(opt) => onChange('sort', opt?.value ?? '')}
          isSearchable={false}
        />
      </div>
    </div>
  );
}
