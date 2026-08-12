'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactSelect from 'react-select';
import { useProjects } from '@/features/projects/hooks/useProjects';
import styles from './RequirementsReportFilters.module.scss';

const useDebouncedValue = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    height: '40px',
    minHeight: '40px',
    border: '1px solid #e6e8ed',
    borderRadius: '8px',
    boxShadow: 'none',
    outline: state.isFocused ? '2px solid var(--color-highlighted)' : 'none',
    fontSize: '0.875rem',
    fontWeight: 400,
    backgroundColor: '#fff',
    cursor: 'pointer',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
};

interface RequirementsReportFiltersProps {
  readonly search: string;
  readonly createdFrom: string;
  readonly createdTo: string;
  readonly projectId: string;
  readonly onSearchChange: (value: string) => void;
  readonly onCreatedFromChange: (value: string) => void;
  readonly onCreatedToChange: (value: string) => void;
  readonly onProjectIdChange: (value: string) => void;
  readonly onExportCsv: () => void;
}

export function RequirementsReportFilters({
  search,
  createdFrom,
  createdTo,
  projectId,
  onSearchChange,
  onCreatedFromChange,
  onCreatedToChange,
  onProjectIdChange,
  onExportCsv,
}: RequirementsReportFiltersProps) {
  const { data: projects = [] } = useProjects();
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onSearchChange(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const projectOptions = [
    { label: 'Todos los proyectos', value: '' },
    ...projects.map((p) => ({ label: p.name, value: String(p.id) })),
  ];

  return (
    <div className={styles.filterSection}>
      <div className={styles.filterField} style={{ flex: 2 }}>
        <label className={styles.fLabel} htmlFor="report-search">
          Búsqueda
        </label>
        <input
          id="report-search"
          type="text"
          className={styles.fInput}
          placeholder="Buscar por título"
          value={searchInput}
          onChange={handleSearchInputChange}
        />
      </div>

      <div className={styles.filterField}>
        <label className={styles.fLabel} htmlFor="report-created-from">
          Desde
        </label>
        <input
          id="report-created-from"
          type="date"
          className={styles.fInput}
          value={createdFrom}
          onChange={(e) => onCreatedFromChange(e.target.value)}
        />
      </div>

      <div className={styles.filterField}>
        <label className={styles.fLabel} htmlFor="report-created-to">
          Hasta
        </label>
        <input
          id="report-created-to"
          type="date"
          className={styles.fInput}
          value={createdTo}
          onChange={(e) => onCreatedToChange(e.target.value)}
        />
      </div>

      <div className={styles.filterField} style={{ flex: 1.4 }}>
        <label className={styles.fLabel} htmlFor="report-project">
          Proyecto
        </label>
        <ReactSelect
          inputId="report-project"
          aria-label="Proyecto"
          styles={selectStyles}
          options={projectOptions}
          value={projectOptions.find((o) => o.value === projectId) ?? projectOptions[0]}
          onChange={(opt) => onProjectIdChange(opt?.value ?? '')}
          isSearchable={false}
        />
      </div>

      <button type="button" className={styles.exportButton} onClick={onExportCsv}>
        Exportar CSV
      </button>
    </div>
  );
}
