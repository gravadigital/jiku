'use client';

import React, { useCallback, useState } from 'react';
import { useRequirementsReport } from '../../hooks/useRequirementsReport';
import { buildRequirementsReportCsv, downloadCsv } from '../../utils/requirementsReportCsv';
import { RequirementsReportFilters } from '../RequirementsReportFilters';
import { RequirementsReportTable } from '../RequirementsReportTable';
import styles from './RequirementsReportPage.module.scss';

interface ReportFiltersState {
  search: string;
  createdFrom: string;
  createdTo: string;
  projectId: string;
}

export function RequirementsReportPage() {
  const [filters, setFilters] = useState<ReportFiltersState>({
    search: '',
    createdFrom: '',
    createdTo: '',
    projectId: '',
  });

  const { data: items = [], isError } = useRequirementsReport(filters);

  const handleSearchChange = useCallback((search: string) => {
    setFilters((f) => ({ ...f, search }));
  }, []);

  const handleCreatedFromChange = useCallback((createdFrom: string) => {
    setFilters((f) => ({ ...f, createdFrom }));
  }, []);

  const handleCreatedToChange = useCallback((createdTo: string) => {
    setFilters((f) => ({ ...f, createdTo }));
  }, []);

  const handleProjectIdChange = useCallback((projectId: string) => {
    setFilters((f) => ({ ...f, projectId }));
  }, []);

  const handleExportCsv = useCallback(() => {
    const csv = buildRequirementsReportCsv(items);
    downloadCsv(csv, 'reporte-requisitos.csv');
  }, [items]);

  return (
    <div className={styles.container}>
      <RequirementsReportFilters
        search={filters.search}
        createdFrom={filters.createdFrom}
        createdTo={filters.createdTo}
        projectId={filters.projectId}
        onSearchChange={handleSearchChange}
        onCreatedFromChange={handleCreatedFromChange}
        onCreatedToChange={handleCreatedToChange}
        onProjectIdChange={handleProjectIdChange}
        onExportCsv={handleExportCsv}
      />

      {isError ? (
        <div className={styles.error}>Ocurrió un error al cargar el reporte</div>
      ) : (
        <RequirementsReportTable items={items} />
      )}
    </div>
  );
}
