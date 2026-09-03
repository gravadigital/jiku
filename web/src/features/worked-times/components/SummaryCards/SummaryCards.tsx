'use client';

import React, { useMemo } from 'react';
import { Card } from '@/shared/components/ui/Card';
import styles from './SummaryCards.module.scss';
import type { ReportByPerson, ReportByProject } from '../../types/worked-time.types';
import type { ReportView } from '../ViewToggle';

interface SummaryCardsProps {
  readonly dataByPerson?: ReportByPerson[];
  readonly dataByProject?: ReportByProject[];
  readonly activeView: ReportView;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function SummaryCards({ dataByPerson, dataByProject, activeView }: SummaryCardsProps) {
  const stats = useMemo(() => {
    if (activeView === 'by-person' && dataByPerson && dataByPerson.length > 0) {
      const totalMinutes = dataByPerson.reduce((sum, p) => sum + p.totalMinutes, 0);
      const personCount = dataByPerson.length;
      const projectIds = new Set<number>();
      for (const person of dataByPerson) {
        for (const project of person.projects) {
          projectIds.add(project.projectId);
        }
      }
      const avgMinutes = Math.round(totalMinutes / personCount);
      return { totalMinutes, personCount, projectCount: projectIds.size, avgMinutes };
    }

    if (activeView === 'by-project' && dataByProject && dataByProject.length > 0) {
      const totalMinutes = dataByProject.reduce((sum, p) => sum + p.totalMinutes, 0);
      const projectCount = dataByProject.length;
      const personIds = new Set<number>();
      for (const project of dataByProject) {
        for (const obj of project.objectives) {
          for (const person of obj.persons) {
            personIds.add(person.personId);
          }
        }
        for (const person of project.persons) {
          personIds.add(person.personId);
        }
      }
      const personCount = personIds.size;
      const avgMinutes = personCount > 0 ? Math.round(totalMinutes / personCount) : 0;
      return { totalMinutes, personCount, projectCount, avgMinutes };
    }

    return null;
  }, [activeView, dataByPerson, dataByProject]);

  if (!stats) return null;

  return (
    <div className={styles.cards}>
      <Card variant="metric" metrics={[{ label: 'Total horas', value: formatHours(stats.totalMinutes) }]} />
      <Card variant="metric" metrics={[{ label: 'Personas', value: String(stats.personCount) }]} />
      <Card variant="metric" metrics={[{ label: 'Proyectos', value: String(stats.projectCount) }]} />
      <Card
        variant="metric"
        metrics={[{ label: 'Promedio / persona', value: formatHours(stats.avgMinutes) }]}
      />
    </div>
  );
}
