'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Button, Input, Select } from '@/shared/components/ui';
import styles from './RequirementsReportFilters.module.scss';

const useDebouncedValue = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
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

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const projectOptions = [
    { label: 'Todos los proyectos', value: '' },
    ...projects.map((p) => ({ label: p.name, value: String(p.id) })),
  ];

  return (
    <div className={styles.filterSection}>
      <div className={styles.filterField}>
        <Input
          variant="search"
          label="Búsqueda"
          placeholder="Buscar por título"
          value={searchInput}
          onChange={handleSearchInputChange}
        />
      </div>

      {/* Decisión 2 del Story Plan: los campos de fecha NO migran a Input variant="date"
          (no es un date picker real) — conservan <input type="date">, solo migran estilos. */}
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

      <div className={styles.filterField}>
        <Select
          variant="single"
          label="Proyecto"
          placeholder="Todos los proyectos"
          options={projectOptions}
          value={projectId}
          onChange={onProjectIdChange}
        />
      </div>

      <Button variant="secondary-dismiss" onClick={onExportCsv}>
        Exportar CSV
      </Button>
    </div>
  );
}
