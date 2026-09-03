'use client';

import React, { useCallback, useMemo } from 'react';
import { Button } from '@/shared/components/ui';
import styles from './WeekNavigator.module.scss';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

interface WeekNavigatorProps {
  readonly weekStart: string;
  readonly onWeekChange: (weekStart: string) => void;
}

const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getMonday = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const formatWeekRange = (weekStartStr: string): string => {
  const monday = new Date(weekStartStr + 'T00:00:00');
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const dayStart = monday.getDate();
  const dayEnd = friday.getDate();
  const monthStart = monday.getMonth();
  const monthEnd = friday.getMonth();
  const yearStart = monday.getFullYear();
  const yearEnd = friday.getFullYear();

  if (yearStart !== yearEnd) {
    return `Semana del ${dayStart} de ${MONTHS[monthStart]} ${yearStart} al ${dayEnd} de ${MONTHS[monthEnd]} ${yearEnd}`;
  }

  if (monthStart !== monthEnd) {
    return `Semana del ${dayStart} de ${MONTHS[monthStart]} al ${dayEnd} de ${MONTHS[monthEnd]} ${yearEnd}`;
  }

  return `Semana del ${dayStart} al ${dayEnd} de ${MONTHS[monthStart]} ${yearEnd}`;
};

export function WeekNavigator({ weekStart, onWeekChange }: WeekNavigatorProps) {
  const currentWeekStart = useMemo(() => getMonday(new Date()), []);
  const isCurrentWeek = weekStart === currentWeekStart;

  const handlePrevious = useCallback(() => {
    onWeekChange(addDays(weekStart, -7));
  }, [weekStart, onWeekChange]);

  const handleNext = useCallback(() => {
    onWeekChange(addDays(weekStart, 7));
  }, [weekStart, onWeekChange]);

  const handleToday = useCallback(() => {
    onWeekChange(currentWeekStart);
  }, [currentWeekStart, onWeekChange]);

  const rangeLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);

  return (
    <div className={styles.container}>
      <div className={styles.navigation}>
        <Button variant="secondary-nav" onClick={handlePrevious}>
          ‹ Anterior
        </Button>
        <span className={styles.rangeLabel}>{rangeLabel}</span>
        <div className={styles.rightActions}>
          <Button variant="secondary-nav" onClick={handleToday} disabled={isCurrentWeek}>
            Esta semana
          </Button>
          <Button variant="secondary-nav" onClick={handleNext}>
            Siguiente ›
          </Button>
        </div>
      </div>
    </div>
  );
}
