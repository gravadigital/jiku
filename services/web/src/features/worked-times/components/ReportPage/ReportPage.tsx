'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Loader } from '@/shared/components/ui/Loader';
import { useReportByPerson } from '../../hooks/useReportByPerson';
import { useReportByProject } from '../../hooks/useReportByProject';
import { useUnworkedTimesReasons } from '../../hooks/useUnworkedTimesReasons';
import { useUnworkedTimesReportByPersons } from '../../hooks/useUnworkedTimesReportByPersons';
import { filterReportByPerson, filterReportByProject } from '../../utils/projectTypeFilter';
import { HierarchicalTable } from '../HierarchicalTable';
import { PeriodFilter } from '../PeriodFilter';
import { ProjectTypeFilterDropdown } from '../ProjectTypeFilterDropdown';
import { SummaryCards } from '../SummaryCards';
import { ViewToggle } from '../ViewToggle';
import styles from './ReportPage.module.scss';
import type { ReportView } from '../ViewToggle';
import type { ProjectType } from '@/features/projects/types/project.types';

function getThisWeekRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  return { dateFrom: format(monday), dateTo: format(sunday) };
}

export function ReportPage() {
  const initialRange = useMemo(() => getThisWeekRange(), []);
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [activeView, setActiveView] = useState<ReportView>('by-person');
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<ProjectType[]>([]);

  const byPerson = useReportByPerson({
    dateFrom,
    dateTo,
    enabled: activeView === 'by-person',
  });

  const byProject = useReportByProject({
    dateFrom,
    dateTo,
    enabled: activeView === 'by-project',
  });

  const activeQuery = activeView === 'by-person' ? byPerson : byProject;

  const { data: projects = [] } = useProjects();
  const projectTypeMap = useMemo(() => {
    const map = new Map<number, ProjectType>();
    projects.forEach((project) => {
      if (project.id !== undefined) map.set(project.id, project.type);
    });
    return map;
  }, [projects]);

  const filteredByPerson = useMemo(
    () => filterReportByPerson(byPerson.data, projectTypeMap, selectedProjectTypes),
    [byPerson.data, projectTypeMap, selectedProjectTypes]
  );

  const filteredByProject = useMemo(
    () => filterReportByProject(byProject.data, projectTypeMap, selectedProjectTypes),
    [byProject.data, projectTypeMap, selectedProjectTypes]
  );

  const personIds = useMemo(() => byPerson.data?.map((p) => p.personId) ?? [], [byPerson.data]);

  const { data: reasons = [] } = useUnworkedTimesReasons();
  const reasonLabels = useMemo(
    () => Object.fromEntries(reasons.map((r) => [r.value, r.label])),
    [reasons]
  );

  const absencesByPerson = useUnworkedTimesReportByPersons({
    dateFrom,
    dateTo,
    personIds,
    enabled: activeView === 'by-person',
  });

  useEffect(() => {
    if (activeQuery.isError) {
      toast.error('Error al cargar los datos del reporte');
    }
  }, [activeQuery.isError]);

  const handlePeriodChange = useCallback((newFrom: string, newTo: string) => {
    setDateFrom(newFrom);
    setDateTo(newTo);
  }, []);

  const handleViewChange = useCallback((view: ReportView) => {
    setActiveView(view);
  }, []);

  const handleProjectTypeFilterChange = useCallback((types: ProjectType[]) => {
    setSelectedProjectTypes(types);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} onPeriodChange={handlePeriodChange} />
        <div className={styles.toggleGroup}>
          <ViewToggle activeView={activeView} onViewChange={handleViewChange} />
          <ProjectTypeFilterDropdown
            value={selectedProjectTypes}
            onChange={handleProjectTypeFilterChange}
          />
        </div>
      </div>

      {activeQuery.isLoading ? (
        <div className={styles.loading}>
          <Loader />
        </div>
      ) : (
        <>
          <SummaryCards
            dataByPerson={filteredByPerson}
            dataByProject={filteredByProject}
            activeView={activeView}
          />
          <HierarchicalTable
            dataByPerson={filteredByPerson}
            dataByProject={filteredByProject}
            activeView={activeView}
            absencesByPerson={absencesByPerson}
            reasonLabels={reasonLabels}
          />
        </>
      )}
    </div>
  );
}
