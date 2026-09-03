'use client';
import React, { useMemo } from 'react';
import { Button } from '../Button';
import { addDays, formatWeekRange, getMonday } from './weekFormat';
import styles from './WeekNav.module.scss';

export interface WeekNavProps {
  readonly weekStart: Date;
  readonly onChange: (weekStart: Date) => void;
  readonly isCurrentWeek: boolean;
}

/**
 * `WeekNavigator` (features/time-allocation) sigue en su lugar: su migración a este
 * componente es de S-058. No se borra acá.
 */
export function WeekNav({ weekStart, onChange, isCurrentWeek }: WeekNavProps) {
  const rangeLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);

  const handlePrevious = () => onChange(addDays(weekStart, -7));
  const handleNext = () => onChange(addDays(weekStart, 7));
  const handleToday = () => onChange(getMonday(new Date()));

  return (
    <nav className={styles.weekNav} aria-label="Navegación de semana">
      <div className={styles.controls}>
        <Button variant="secondary-nav" onClick={handlePrevious}>
          ‹ Anterior
        </Button>
        <span className={styles.rangeLabel}>{rangeLabel}</span>
        <Button variant="secondary-nav" onClick={handleToday} disabled={isCurrentWeek}>
          Esta semana
        </Button>
        <Button variant="secondary-nav" onClick={handleNext}>
          Siguiente ›
        </Button>
      </div>
      <span className={styles.liveRegion} aria-live="polite" role="status">
        {rangeLabel}
      </span>
    </nav>
  );
}
