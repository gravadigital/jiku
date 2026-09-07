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

      {/* La Decisión 2 del Story Plan mantenía estos campos fuera de `Input variant="date"`
          porque la variante "no es un date picker real": renderizaba `type="text"`. Arreglada
          la variante, el motivo desapareció y los campos migran. */}
      <div className={styles.filterField}>
        <Input variant="date" label="Desde" value={createdFrom} onChange={onCreatedFromChange} />
      </div>

      <div className={styles.filterField}>
        <Input variant="date" label="Hasta" value={createdTo} onChange={onCreatedToChange} />
      </div>

      <div className={styles.filterField}>
        {/* Mismo caso que el filtro del listado: la lista de proyectos es larga y no
            memorizable, así que el selector necesita buscador. */}
        <Select
          variant="single"
          label="Proyecto"
          placeholder="Todos los proyectos"
          options={projectOptions}
          value={projectId}
          onChange={onProjectIdChange}
          searchable
        />
      </div>

      <Button variant="secondary-dismiss" onClick={onExportCsv}>
        Exportar CSV
      </Button>
    </div>
  );
}
