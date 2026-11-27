'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Loader } from '@/shared/components/ui/Loader';
import { Table, type TableColumn, type TableRow } from '@/shared/components/ui/Table';
import { WeekNav } from '@/shared/components/ui/WeekNav';
import { useHoursPerDay } from '../../hooks/useHoursPerDay';
import { useSaveAllocations } from '../../hooks/useSaveAllocations';
import { useWeekAllocations } from '../../hooks/useWeekAllocations';
import { EditableCell } from '../EditableCell';
import styles from './WeeklyAllocationTable.module.scss';
import type {
  PersonBasic,
  ProjectBasic,
  WeekAllocationSaveItem,
} from '../../types/time-allocation.types';

const getMondayStr = (date: Date | string): string => {
  const d =
    typeof date === 'string'
      ? (() => {
          const [y, m, dd] = date.split('-').map(Number);
          return new Date(y, m - 1, dd);
        })()
      : new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// weekStart es un string 'YYYY-MM-DD' en todo el feature (API, hooks). WeekNav trabaja con
// Date; estas dos funciones son la conversión en el borde, sin tocar weekFormat.ts.
const weekStartStrToDate = (weekStart: string): Date => {
  const [y, m, d] = weekStart.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const dateToWeekStartStr = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getPreviousWeekStart = (weekStart: string): string => {
  const [y, m, d] = weekStart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 7);
  return getMondayStr(date);
};

const formatPercentage = (value: number): string => {
  return value % 1 === 0 ? `${value}%` : `${value.toFixed(1)}%`;
};

const formatHours = (value: number): string => {
  return value % 1 === 0 ? `${value}h` : `${value.toFixed(1)}h`;
};

const formatPersonName = (person: PersonBasic): string => {
  return `${person.firstName} ${person.lastName.charAt(0)}.`;
};

const minutesToPercentage = (minutes: number, hoursPerDay: number): number => {
  const weekTotalMinutes = hoursPerDay * 5 * 60;
  return (minutes / weekTotalMinutes) * 100;
};

const percentageToMinutes = (percentage: number, hoursPerDay: number): number => {
  const weekTotalMinutes = hoursPerDay * 5 * 60;
  return Math.round((percentage / 100) * weekTotalMinutes);
};

const PROJECT_GROUP_LABELS: Record<number, string> = {
  0: 'Comerciales activos',
  1: 'Internos activos',
  2: 'En análisis',
};

export function WeeklyAllocationTable() {
  const [weekStart, setWeekStart] = useState(() => getMondayStr(new Date()));
  const [localAllocations, setLocalAllocations] = useState<Record<string, number>>({});
  const [isPreloaded, setIsPreloaded] = useState(false);

  const { data: session } = useSession();
  const isAdmin = session?.user?.roles?.includes('admin') ?? false;

  const {
    data: weekData,
    isLoading: isLoadingAllocations,
    isError: isErrorAllocations,
  } = useWeekAllocations(weekStart);

  const {
    data: hoursPerDayData,
    isLoading: isLoadingHours,
    isError: isErrorHours,
  } = useHoursPerDay();

  const saveMutation = useSaveAllocations();

  const handleWeekChange = useCallback((newWeekStartDate: Date) => {
    setWeekStart(dateToWeekStartStr(newWeekStartDate));
    setIsPreloaded(false);
  }, []);

  const hoursPerDay = hoursPerDayData?.hoursPerDay ?? 6;

  const allocations = useMemo(() => weekData?.allocations ?? [], [weekData?.allocations]);
  const persons = useMemo(() => weekData?.persons ?? [], [weekData?.persons]);
  const rawProjects = useMemo(() => weekData?.projects ?? [], [weekData?.projects]);

  const { data: fullProjects } = useProjects({
    filters: { state: 'activo' },
    enabled: rawProjects.length > 0,
  });
  const { data: analysisProjects } = useProjects({
    filters: { state: 'analisis' },
    enabled: rawProjects.length > 0,
  });

  const sortedProjects = useMemo(() => {
    const allFullProjects = [...(fullProjects ?? []), ...(analysisProjects ?? [])];
    const projectInfoMap = new Map(
      allFullProjects.map((p) => [p.id, { type: p.type, status: p.status }])
    );

    const getGroup = (project: ProjectBasic): number => {
      const info = projectInfoMap.get(project.id);
      if (!info) return 2;
      if (info.status === 'activo' && info.type === 'comercial') return 0;
      if (info.status === 'activo') return 1;
      return 2;
    };

    const sorted = [...rawProjects].sort((a, b) => {
      const groupDiff = getGroup(a) - getGroup(b);
      if (groupDiff !== 0) return groupDiff;
      return a.name.localeCompare(b.name, 'es');
    });

    const groups: { label: string | null; projects: ProjectBasic[] }[] = [];
    let currentGroup = -1;
    for (const project of sorted) {
      const group = getGroup(project);
      if (group !== currentGroup) {
        currentGroup = group;
        groups.push({ label: PROJECT_GROUP_LABELS[group], projects: [project] });
      } else {
        groups[groups.length - 1].projects.push(project);
      }
    }

    return groups;
  }, [rawProjects, fullProjects, analysisProjects]);

  const projects = rawProjects;

  const isLoading = isLoadingAllocations || isLoadingHours;
  const isError = isErrorAllocations || isErrorHours;

  const isWeekEditable = useCallback((week: string): boolean => {
    const today = new Date();
    const currentMonday = getMondayStr(today);
    const isSunday = today.getDay() === 0;

    if (isSunday) {
      return week > currentMonday;
    }

    return week >= currentMonday;
  }, []);

  const isEditable = useMemo(() => {
    return isAdmin && isWeekEditable(weekStart);
  }, [isAdmin, weekStart, isWeekEditable]);

  const isCurrentWeek = useMemo(() => weekStart === getMondayStr(new Date()), [weekStart]);

  const previousWeekStart = useMemo(() => getPreviousWeekStart(weekStart), [weekStart]);

  const shouldFetchPrevious = useMemo(() => {
    return allocations.length === 0 && isAdmin && isEditable;
  }, [allocations.length, isAdmin, isEditable]);

  const { data: previousWeekData } = useWeekAllocations(previousWeekStart, {
    enabled: shouldFetchPrevious,
  });

  useEffect(() => {
    if (isError) {
      toast.error('Error al cargar las asignaciones de tiempo');
    }
  }, [isError]);

  useEffect(() => {
    if (allocations.length > 0) {
      const initial: Record<string, number> = {};
      allocations.forEach((alloc) => {
        const key = `${alloc.personId}-${alloc.projectId}`;
        initial[key] = minutesToPercentage(alloc.minutes, hoursPerDay);
      });
      setLocalAllocations(initial);
    }
  }, [allocations, hoursPerDay]);

  useEffect(() => {
    if (
      shouldFetchPrevious &&
      allocations.length === 0 &&
      previousWeekData?.allocations &&
      previousWeekData.allocations.length > 0
    ) {
      const preloadedState: Record<string, number> = {};
      previousWeekData.allocations.forEach((alloc) => {
        const key = `${alloc.personId}-${alloc.projectId}`;
        const percentage = minutesToPercentage(alloc.minutes, hoursPerDay);
        preloadedState[key] = percentage;
      });
      setLocalAllocations(preloadedState);
      setIsPreloaded(true);
    }
  }, [shouldFetchPrevious, previousWeekData, hoursPerDay, allocations.length]);

  const getPersonTotalFromLocal = useCallback(
    (personId: number): number => {
      return projects.reduce((sum, project) => {
        const key = `${personId}-${project.id}`;
        return sum + (localAllocations[key] ?? 0);
      }, 0);
    },
    [localAllocations, projects]
  );

  const getProjectTotalFromLocal = useCallback(
    (projectId: number): number => {
      return persons.reduce((sum, person) => {
        const key = `${person.id}-${projectId}`;
        const percentage = localAllocations[key] ?? 0;
        return sum + percentage;
      }, 0);
    },
    [localAllocations, persons]
  );

  const overallocatedPersons = useMemo(() => {
    const overallocated = new Set<number>();
    persons.forEach((person) => {
      const total = getPersonTotalFromLocal(person.id);
      if (total > 100) {
        overallocated.add(person.id);
      }
    });
    return overallocated;
  }, [persons, getPersonTotalFromLocal]);

  const hasChanges = useMemo(() => {
    const serverState: Record<string, number> = {};
    allocations.forEach((alloc) => {
      const key = `${alloc.personId}-${alloc.projectId}`;
      serverState[key] = minutesToPercentage(alloc.minutes, hoursPerDay);
    });

    return JSON.stringify(localAllocations) !== JSON.stringify(serverState);
  }, [localAllocations, allocations, hoursPerDay]);

  const handleSave = useCallback(() => {
    const allocationItems: WeekAllocationSaveItem[] = [];

    Object.entries(localAllocations).forEach(([key, percentage]) => {
      if (percentage > 0) {
        const [personIdStr, projectIdStr] = key.split('-');
        const personId = parseInt(personIdStr, 10);
        const projectId = parseInt(projectIdStr, 10);
        const minutes = percentageToMinutes(percentage, hoursPerDay);

        allocationItems.push({ personId, projectId, minutes });
      }
    });

    saveMutation.mutate(
      { weekStart, allocations: allocationItems },
      {
        onSuccess: () => {
          toast.success('Cambios guardados correctamente');
          setIsPreloaded(false);
        },
        onError: (error: unknown) => {
          const message = (error as { message?: string })?.message || 'Error al guardar los cambios';
          toast.error(message);
        },
      }
    );
  }, [localAllocations, weekStart, hoursPerDay, saveMutation]);

  const renderCellContent = useCallback(
    (person: PersonBasic, project: ProjectBasic): React.ReactNode => {
      const key = `${person.id}-${project.id}`;
      const percentage = localAllocations[key] ?? 0;
      const isOverallocated = overallocatedPersons.has(person.id);

      if (isEditable) {
        return (
          <EditableCell
            key={key}
            personId={person.id}
            projectId={project.id}
            personName={`${person.firstName} ${person.lastName}`}
            projectName={project.name}
            value={percentage}
            onChange={(newPercentage) => {
              setLocalAllocations((prev) => ({ ...prev, [key]: newPercentage }));
            }}
            hoursPerDay={hoursPerDay}
            isOverallocated={isOverallocated}
          />
        );
      }

      const hours = (percentage / 100) * hoursPerDay * 5;
      const isEmpty = percentage === 0;

      return (
        <span className={isEmpty ? styles.emptyCell : undefined}>
          <span className={isOverallocated ? styles.overallocatedText : styles.percentage}>
            {formatPercentage(percentage)}
          </span>{' '}
          <span className={isOverallocated ? styles.overallocatedText : styles.hours}>
            {formatHours(hours)}
          </span>
        </span>
      );
    },
    [localAllocations, isEditable, hoursPerDay, overallocatedPersons]
  );

  const columns: TableColumn[] = useMemo(() => {
    const personColumns: TableColumn[] = persons.map((person) => ({
      key: `person-${person.id}`,
      label: formatPersonName(person),
    }));
    return [
      { key: 'project', label: 'Proyecto', scope: 'row' },
      ...personColumns,
      { key: 'total', label: 'Total' },
    ];
  }, [persons]);

  const rows: TableRow[] = useMemo(() => {
    const projectRows: TableRow[] = [];

    for (const group of sortedProjects) {
      group.projects.forEach((project, index) => {
        const row: Record<string, React.ReactNode> = {
          // El agrupador (versalitas, DS spec) va como texto pequeño encima del nombre del
          // proyecto en la primera fila de cada grupo — Table no soporta una fila que abarque
          // todas las columnas (colSpan), así que la agrupación se preserva de esta forma en
          // vez de perderse.
          project: (
            <span className={styles.projectCell}>
              {index === 0 && group.label && (
                <span className={styles.groupLabel}>{group.label}</span>
              )}
              <span className={styles.projectName}>{project.name}</span>
            </span>
          ),
        };
        for (const person of persons) {
          row[`person-${person.id}`] = renderCellContent(person, project);
        }
        const totalHours = (getProjectTotalFromLocal(project.id) / 100) * hoursPerDay * 5;
        row.total = <span className={styles.totalCell}>{formatHours(totalHours)}</span>;
        projectRows.push(row as TableRow);
      });
    }

    if (projectRows.length > 0) {
      const totalRow: Record<string, React.ReactNode> = {
        project: <span className={styles.projectName}>Total</span>,
      };
      for (const person of persons) {
        const totalPercentage = getPersonTotalFromLocal(person.id);
        const totalHours = (totalPercentage / 100) * hoursPerDay * 5;
        const isOverallocated = totalPercentage > 100;
        totalRow[`person-${person.id}`] = (
          <span className={isOverallocated ? styles.overallocatedText : undefined}>
            {formatPercentage(totalPercentage)} · {formatHours(totalHours)}
          </span>
        );
      }
      totalRow.total = '';
      projectRows.push(totalRow as TableRow);
    }

    return projectRows;
  }, [sortedProjects, persons, renderCellContent, getProjectTotalFromLocal, getPersonTotalFromLocal, hoursPerDay]);

  return (
    <div className={styles.container}>
      <WeekNav
        weekStart={weekStartStrToDate(weekStart)}
        onChange={handleWeekChange}
        isCurrentWeek={isCurrentWeek}
      />

      {isPreloaded && (
        // banner-precarga: alert info, gap `alert` aceptado por el REQ — se resuelve inline
        // con tokens, sin componente (ver DS Gaps → Aceptados).
        <div className={styles.preloadBanner} role="status">
          <span>Valores precargados de la semana anterior</span>
        </div>
      )}

      {isLoading && (
        <div className={styles.loaderContainer}>
          <Loader label="Cargando asignaciones..." />
        </div>
      )}

      {!isLoading && isError && (
        // mensaje-error: alert error, gap `alert` aceptado. No comparte marcado con
        // EmptyState (D-la ficha lo registra: hoy comparten .emptyState pese a ser distintos).
        <div className={styles.errorState} role="alert">
          <p>No se pudieron cargar las asignaciones. Intentá de nuevo más tarde.</p>
        </div>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState variant="list" message="No hay proyectos con asignaciones para esta semana." />
      )}

      {!isLoading && !isError && projects.length > 0 && (
        <Table
          variant="matrix"
          columns={columns}
          rows={rows}
          ariaLabel="Asignación semanal de proyecto por persona"
        />
      )}

      {isEditable && !isLoading && !isError && projects.length > 0 && (
        <div className={styles.saveButtonContainer}>
          <Button onClick={handleSave} loading={saveMutation.isPending} disabled={!hasChanges}>
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}
