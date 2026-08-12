'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Button, Loader } from '@/shared/components/ui';
import { cn } from '@/shared/utils';
import { useHoursPerDay } from '../../hooks/useHoursPerDay';
import { useSaveAllocations } from '../../hooks/useSaveAllocations';
import { useWeekAllocations } from '../../hooks/useWeekAllocations';
import { EditableCell } from '../EditableCell';
import { WeekNavigator } from '../WeekNavigator';
import styles from './WeeklyAllocationTable.module.scss';
import type {
  PersonBasic,
  ProjectBasic,
  WeekAllocationSaveItem,
} from '../../types/time-allocation.types';

const getMonday = (date: Date | string): string => {
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

const getPreviousWeekStart = (weekStart: string): string => {
  const [y, m, d] = weekStart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 7);
  return getMonday(date);
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
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
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

  const handleWeekChange = useCallback((newWeekStart: string) => {
    setWeekStart(newWeekStart);
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
    const currentMonday = getMonday(today);
    const isSunday = today.getDay() === 0;

    if (isSunday) {
      // On Sunday, only future weeks are editable
      return week > currentMonday;
    }

    // On other days, current and future weeks are editable
    return week >= currentMonday;
  }, []);

  const isEditable = useMemo(() => {
    return isAdmin && isWeekEditable(weekStart);
  }, [isAdmin, weekStart, isWeekEditable]);

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
  }, [persons, getPersonTotalFromLocal, localAllocations]);

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
        onError: (error: any) => {
          const message = error.message || 'Error al guardar los cambios';
          toast.error(message);
        },
      }
    );
  }, [localAllocations, weekStart, hoursPerDay, saveMutation]);

  const renderCell = useCallback(
    (personId: number, projectId: number) => {
      const key = `${personId}-${projectId}`;
      const percentage = localAllocations[key] ?? 0;
      const isOverallocated = overallocatedPersons.has(personId);

      if (isEditable) {
        return (
          <EditableCell
            key={key}
            personId={personId}
            projectId={projectId}
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
        <td
          key={key}
          className={cn(styles.cell, {
            [styles.emptyCell]: isEmpty,
            [styles.overallocated]: isOverallocated,
          })}
        >
          <span className={styles.percentage}>{formatPercentage(percentage)}</span>
          <span className={styles.hours}>{formatHours(hours)}</span>
        </td>
      );
    },
    [localAllocations, isEditable, hoursPerDay, overallocatedPersons]
  );

  const renderProjectTotalCell = useCallback(
    (projectId: number) => {
      const totalPercentage = getProjectTotalFromLocal(projectId);
      const totalHours = (totalPercentage / 100) * hoursPerDay * 5;

      return (
        <td key={`total-project-${projectId}`} className={styles.totalCell}>
          <span className={styles.hours}>{formatHours(totalHours)}</span>
        </td>
      );
    },
    [getProjectTotalFromLocal, hoursPerDay]
  );

  const renderPersonTotalCell = useCallback(
    (personId: number) => {
      const totalPercentage = getPersonTotalFromLocal(personId);
      const totalHours = (totalPercentage / 100) * hoursPerDay * 5;
      const isOverallocated = totalPercentage > 100;

      return (
        <td
          key={`total-person-${personId}`}
          className={cn(styles.totalCell, {
            [styles.overallocated]: isOverallocated,
          })}
        >
          <span className={styles.percentage}>{formatPercentage(totalPercentage)}</span>
          <span className={styles.hours}>{formatHours(totalHours)}</span>
        </td>
      );
    },
    [getPersonTotalFromLocal, hoursPerDay]
  );

  return (
    <div className={styles.container}>
      <WeekNavigator weekStart={weekStart} onWeekChange={handleWeekChange} />

      {isPreloaded && (
        <div className={styles.preloadBanner}>
          <span>ℹ️ Valores precargados de la semana anterior</span>
        </div>
      )}

      {isLoading && (
        <div className={styles.loaderContainer}>
          <Loader label="Cargando asignaciones..." />
        </div>
      )}

      {!isLoading && isError && (
        <div className={styles.emptyState}>
          <p>No se pudieron cargar las asignaciones. Intentá de nuevo más tarde.</p>
        </div>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <div className={styles.emptyState}>
          <p>No hay proyectos con asignaciones para esta semana.</p>
        </div>
      )}

      {!isLoading && !isError && projects.length > 0 && (
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th className={styles.projectHeader}>Proyecto</th>
                {persons.map((person) => (
                  <th key={person.id}>{formatPersonName(person)}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedProjects.map((group) => (
                <React.Fragment key={group.label}>
                  <tr className={styles.groupRow}>
                    <td className={styles.groupLabel} colSpan={persons.length + 2}>
                      {group.label}
                    </td>
                  </tr>
                  {group.projects.map((project) => (
                    <tr key={project.id}>
                      <td className={styles.projectCell}>
                        <span className={styles.projectName}>{project.name}</span>
                      </td>
                      {persons.map((person) => renderCell(person.id, project.id))}
                      {renderProjectTotalCell(project.id)}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              <tr className={styles.totalRow}>
                <td className={styles.projectCell}>
                  <span className={styles.projectName}>Total</span>
                </td>
                {persons.map((person) => renderPersonTotalCell(person.id))}
                <td className={styles.totalCell} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {isEditable && !isLoading && !isError && projects.length > 0 && (
        <div className={styles.saveButtonContainer}>
          <Button
            label="Guardar"
            onClick={handleSave}
            loading={saveMutation.isPending}
            disabled={!hasChanges}
          />
        </div>
      )}
    </div>
  );
}
